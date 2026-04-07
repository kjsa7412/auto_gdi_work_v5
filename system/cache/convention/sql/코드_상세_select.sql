SELECT
    wrk_tp_cd,
    cd_tp_cd,
    comm_cd,
    comm_cd_nm,
    comm_cd_desc,
    sort_ord,
    use_yn,
    rel_wrk_tp_cd,
    rel_cd_tp_cd,
    rel_comm_cd,
    cd_prop_val1,
    cd_prop_val2,
    cd_prop_val3,
    cd_prop_val4,
    cd_prop_val5
FROM sy_code_dtl
WHERE use_yn = 'Y'
ORDER BY wrk_tp_cd, cd_tp_cd, sort_ord, comm_cd;
