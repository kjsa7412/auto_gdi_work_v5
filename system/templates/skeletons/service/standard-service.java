package com.sjinc.sjerp.proj./* TODO: 모듈소문자 */./* TODO: 분류소문자 */./* TODO: 화면ID소문자 */;

import com.sjinc.sjerp.proj.base.BaseService;

import lombok.extern.slf4j.Slf4j;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * /* TODO: 화면명 */ Service
 * 화면ID: /* TODO: 화면ID */
 */
@Slf4j
@Service
public class /* TODO: 화면ID */Service extends BaseService {

    private final SqlSessionTemplate ferpReaderSqlSessionTemplate;

    /* 생성자 주입: writer는 BaseService에서 관리, reader는 직접 주입 */
    public /* TODO: 화면ID */Service(
            SqlSessionTemplate ferpWriterSqlSessionTemplate,
            SqlSessionTemplate ferpReaderSqlSessionTemplate) {
        this.ferpReaderSqlSessionTemplate = ferpReaderSqlSessionTemplate;
    }

    // ──────────────────────────────────────
    // 목록 조회
    // ──────────────────────────────────────
    @Transactional(value = "txManagerReader", readOnly = true)
    public List<Map<String, Object>> selectList(Map<String, Object> param) throws Exception {
        String statement = (String) param.get("statement");
        /* TODO: statement가 null이면 기본값 세팅
        if (statement == null) {
            statement = "namespace.selectList";
        }
        */
        return ferpReaderSqlSessionTemplate.selectList(statement, param);
    }

    // ──────────────────────────────────────
    // 단건 조회
    // ──────────────────────────────────────
    @Transactional(value = "txManagerReader", readOnly = true)
    public Map<String, Object> selectInfo(Map<String, Object> param) throws Exception {
        String statement = (String) param.get("statement");
        return ferpReaderSqlSessionTemplate.selectOne(statement, param);
    }

    // ──────────────────────────────────────
    // 저장 (등록/수정)
    // ──────────────────────────────────────
    @Transactional(value = "txManagerFerpWriter")
    public int save(Map<String, Object> param) throws Exception {
        String statement = (String) param.get("statement");

        /* statement에 따라 INSERT 또는 UPDATE 분기 */
        if (statement != null && statement.contains("insert")) {
            return ferpReaderSqlSessionTemplate.insert(statement, param);
        } else {
            return ferpReaderSqlSessionTemplate.update(statement, param);
        }

        /* TODO: 다중 테이블 저장이 필요한 경우
        int result = 0;
        // 마스터 저장
        result += ferpReaderSqlSessionTemplate.insert("namespace.insertMaster", param);
        // 상세 저장 (List 파라미터)
        List<Map<String, Object>> detailList = (List<Map<String, Object>>) param.get("detailList");
        if (detailList != null) {
            for (Map<String, Object> detail : detailList) {
                detail.put("reg_pgm_id", param.get("reg_pgm_id"));
                detail.put("login_user_id", param.get("login_user_id"));
                detail.put("login_user_ip", param.get("login_user_ip"));
                result += ferpReaderSqlSessionTemplate.insert("namespace.insertDetail", detail);
            }
        }
        return result;
        */
    }

    // ──────────────────────────────────────
    // 삭제
    // ──────────────────────────────────────
    @Transactional(value = "txManagerFerpWriter")
    public int delete(Map<String, Object> param) throws Exception {
        String statement = (String) param.get("statement");

        /* TODO: 상세 테이블 먼저 삭제 후 마스터 삭제 (참조 무결성)
        ferpReaderSqlSessionTemplate.delete("namespace.deleteDetail", param);
        */

        return ferpReaderSqlSessionTemplate.delete(statement, param);
    }
}
