CREATE OR REPLACE FUNCTION public.admin_edit_pending_order(
    p_order_number text,
    p_delivery_address text,
    p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    o public.orders%ROWTYPE;
    line record;
    count_items integer;
    v_subtotal numeric(12,2);
    before_json jsonb;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_staff() THEN
        RAISE EXCEPTION 'STAFF_ONLY';
    END IF;

    SELECT *
    INTO o
    FROM public.orders
    WHERE order_number = p_order_number
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND';
    END IF;

    IF o.status <> 'pending'
       OR o.payment_status <> 'unpaid' THEN
        RAISE EXCEPTION 'ONLY_PENDING_UNPAID_EDITABLE';
    END IF;

    IF p_items IS NULL
       OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'INVALID_ITEMS';
    END IF;

    SELECT count(*)
    INTO count_items
    FROM public.order_items
    WHERE order_id = o.id;

    IF count_items = 0
       OR jsonb_array_length(p_items) <> count_items THEN
        RAISE EXCEPTION 'ALL_ITEMS_REQUIRED';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_items) j
        WHERE jsonb_typeof(j) <> 'object'
           OR NOT (j ? 'id')
           OR NOT (j ? 'quantity')
           OR (j->>'quantity') !~ '^[0-9]+$'
    ) THEN
        RAISE EXCEPTION 'INVALID_ITEMS';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_items) j
        GROUP BY j->>'id'
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'DUPLICATE_ITEM';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_items) j
        LEFT JOIN public.order_items oi
            ON oi.id::text = j->>'id'
           AND oi.order_id = o.id
        WHERE oi.id IS NULL
    ) THEN
        RAISE EXCEPTION 'ITEM_NOT_FOUND';
    END IF;

    SELECT jsonb_build_object(
        'order', to_jsonb(o),
        'items', COALESCE(
            (
                SELECT jsonb_agg(to_jsonb(oi))
                FROM public.order_items oi
                WHERE oi.order_id = o.id
            ),
            '[]'::jsonb
        )
    )
    INTO before_json;

    FOR line IN
        SELECT
            j->>'id' AS id,
            (j->>'quantity')::numeric AS quantity
        FROM jsonb_array_elements(p_items) j
    LOOP
        IF line.quantity < 1
           OR line.quantity > 10000
           OR line.quantity <> trunc(line.quantity) THEN
            RAISE EXCEPTION 'INVALID_QUANTITY';
        END IF;

        UPDATE public.order_items AS oi
        SET
            quantity = line.quantity::integer,
            line_total = round(
                oi.unit_price * line.quantity, 2
            )
        WHERE oi.id::text = line.id
          AND oi.order_id = o.id;
    END LOOP;

    -- คำนวณยอดรวมสินค้าใหม่
    SELECT COALESCE(SUM(oi.line_total), 0)
    INTO v_subtotal
    FROM public.order_items AS oi
    WHERE oi.order_id = o.id;

    -- อัปเดตยอดรวม โดยใช้ v_subtotal
    -- เพื่อไม่ให้ชื่อซ้ำกับคอลัมน์ subtotal
    UPDATE public.orders AS ord
    SET
        delivery_address = NULLIF(
            btrim(p_delivery_address), ''
        ),
        subtotal = v_subtotal,
        total_amount = GREATEST(
            0,
            v_subtotal - ord.discount_amount
        ),
        updated_at = now()
    WHERE ord.id = o.id;

    -- บันทึกประวัติการแก้ไข
    INSERT INTO public.order_admin_audit(
        order_id,
        action,
        before_data,
        after_data,
        actor_id
    )
    VALUES (
        o.id,
        'edited',
        before_json,
        jsonb_build_object(
            'order',
            (
                SELECT to_jsonb(x)
                FROM public.orders x
                WHERE x.id = o.id
            ),
            'items',
            (
                SELECT jsonb_agg(to_jsonb(oi))
                FROM public.order_items oi
                WHERE oi.order_id = o.id
            )
        ),
        auth.uid()
    );

    RETURN o.id;
END;
$$;