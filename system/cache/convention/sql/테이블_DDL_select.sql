SELECT
    'CREATE TABLE ' || c.table_name || ' (' || chr(10) ||
    string_agg(
        '    ' || c.column_name || ' ' || c.data_type ||
        CASE
            WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')'
            WHEN c.numeric_precision IS NOT NULL AND c.data_type = 'numeric' THEN '(' || c.numeric_precision || ',' || COALESCE(c.numeric_scale, 0) || ')'
            ELSE ''
        END ||
        CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END,
        ',' || chr(10)
        ORDER BY c.ordinal_position
    ) || chr(10) ||
    COALESCE(
        ',    CONSTRAINT ' || tc.constraint_name || ' PRIMARY KEY (' ||
        (SELECT string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
         FROM information_schema.key_column_usage kcu
         WHERE kcu.table_schema = tc.table_schema
           AND kcu.table_name = tc.table_name
           AND kcu.constraint_name = tc.constraint_name) || ')',
        ''
    ) || chr(10) ||
    ');' AS ddl
FROM information_schema.columns c
LEFT JOIN information_schema.table_constraints tc
    ON tc.table_schema = c.table_schema
    AND tc.table_name = c.table_name
    AND tc.constraint_type = 'PRIMARY KEY'
WHERE c.table_schema = 'public'
GROUP BY c.table_name, tc.constraint_name, tc.table_schema, tc.table_name
ORDER BY c.table_name;
