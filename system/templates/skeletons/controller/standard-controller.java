package com.sjinc.sjerp.proj./* TODO: 모듈소문자 */./* TODO: 분류소문자 */./* TODO: 화면ID소문자 */;

import com.sjinc.sjerp.frame.annotation.AddUserInfo;
import com.sjinc.sjerp.frame.annotation.LogAction;
import com.sjinc.sjerp.frame.utils.FrameConstants;
import com.sjinc.sjerp.proj.base.BaseResponse;
import com.sjinc.sjerp.proj.login.LoginUserVo;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.List;
import java.util.Map;

/**
 * /* TODO: 화면명 */ Controller
 * 화면ID: /* TODO: 화면ID */
 */
@Slf4j
@Controller
@RequestMapping("//* TODO: 화면ID소문자 */")
public class /* TODO: 화면ID */Controller {

    private final /* TODO: 화면ID */Service /* TODO: 화면ID소문자 */Service;

    /* 생성자 주입 (DI) */
    public /* TODO: 화면ID */Controller(/* TODO: 화면ID */Service /* TODO: 화면ID소문자 */Service) {
        this./* TODO: 화면ID소문자 */Service = /* TODO: 화면ID소문자 */Service;
    }

    // ──────────────────────────────────────
    // 목록 조회
    // ──────────────────────────────────────
    @LogAction
    @AddUserInfo
    @ResponseBody
    @RequestMapping(value = "/select")
    public BaseResponse select(HttpServletRequest request, @RequestBody Map<String, Object> param) {
        try {
            LoginUserVo loginUserVo = (LoginUserVo) request.getAttribute(FrameConstants.LOGIN_USER_ATTR);
            param.put("reg_pgm_id", "/* TODO: 화면ID */");
            param.put("login_user_id", loginUserVo.getLogin_user_id());
            param.put("login_user_ip", loginUserVo.getLogin_user_ip());

            List<Map<String, Object>> result = /* TODO: 화면ID소문자 */Service.selectList(param);
            return BaseResponse.Ok(result);
        } catch (Exception ex) {
            log.error(ex.getMessage(), ex);
            return BaseResponse.Error("조회 중 문제가 발생되었습니다.");
        }
    }

    // ──────────────────────────────────────
    // 단건 조회
    // ──────────────────────────────────────
    @LogAction
    @AddUserInfo
    @ResponseBody
    @RequestMapping(value = "/selectInfo")
    public BaseResponse selectInfo(HttpServletRequest request, @RequestBody Map<String, Object> param) {
        try {
            LoginUserVo loginUserVo = (LoginUserVo) request.getAttribute(FrameConstants.LOGIN_USER_ATTR);
            param.put("reg_pgm_id", "/* TODO: 화면ID */");
            param.put("login_user_id", loginUserVo.getLogin_user_id());
            param.put("login_user_ip", loginUserVo.getLogin_user_ip());

            Map<String, Object> result = /* TODO: 화면ID소문자 */Service.selectInfo(param);
            return BaseResponse.Ok(result);
        } catch (Exception ex) {
            log.error(ex.getMessage(), ex);
            return BaseResponse.Error("조회 중 문제가 발생되었습니다.");
        }
    }

    // ──────────────────────────────────────
    // 저장 (등록/수정)
    // ──────────────────────────────────────
    @LogAction
    @AddUserInfo
    @ResponseBody
    @RequestMapping(value = "/save")
    public BaseResponse save(HttpServletRequest request, @RequestBody Map<String, Object> param) {
        try {
            LoginUserVo loginUserVo = (LoginUserVo) request.getAttribute(FrameConstants.LOGIN_USER_ATTR);
            param.put("reg_pgm_id", "/* TODO: 화면ID */");
            param.put("login_user_id", loginUserVo.getLogin_user_id());
            param.put("login_user_ip", loginUserVo.getLogin_user_ip());
            param.put("login_emp_no", loginUserVo.getLogin_emp_no());

            int result = /* TODO: 화면ID소문자 */Service.save(param);
            return BaseResponse.Ok(result);
        } catch (Exception ex) {
            log.error(ex.getMessage(), ex);
            return BaseResponse.Error("저장 중 문제가 발생되었습니다.");
        }
    }

    // ──────────────────────────────────────
    // 삭제
    // ──────────────────────────────────────
    @LogAction
    @AddUserInfo
    @ResponseBody
    @RequestMapping(value = "/delete")
    public BaseResponse delete(HttpServletRequest request, @RequestBody Map<String, Object> param) {
        try {
            LoginUserVo loginUserVo = (LoginUserVo) request.getAttribute(FrameConstants.LOGIN_USER_ATTR);
            param.put("reg_pgm_id", "/* TODO: 화면ID */");
            param.put("login_user_id", loginUserVo.getLogin_user_id());
            param.put("login_user_ip", loginUserVo.getLogin_user_ip());

            int result = /* TODO: 화면ID소문자 */Service.delete(param);
            return BaseResponse.Ok(result);
        } catch (Exception ex) {
            log.error(ex.getMessage(), ex);
            return BaseResponse.Error("삭제 중 문제가 발생되었습니다.");
        }
    }
}
