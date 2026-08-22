package com.sistema.polleria.auth.service;

import com.sistema.polleria.auth.entity.TwoFactorToken;
import com.sistema.polleria.auth.entity.User;
import com.sistema.polleria.auth.repository.TwoFactorTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class TwoFactorService {

    private final TwoFactorTokenRepository tokenRepository;
    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${security.two-factor.code-expiry-minutes:5}")
    private int codeExpiryMinutes;

    private static final SecureRandom RANDOM = new SecureRandom();

    @Transactional
    public void sendVerificationCode(User user) {
        // Invalida códigos anteriores
        tokenRepository.invalidatePreviousTokens(user);

        String code = generateCode();

        TwoFactorToken token = TwoFactorToken.builder()
                .user(user)
                .code(code)
                .expiresAt(LocalDateTime.now().plusMinutes(codeExpiryMinutes))
                .build();

        tokenRepository.save(token);
        sendEmail(user.getEmail(), user.getName(), code);
        log.info("Código 2FA enviado al correo: {}", user.getEmail());
    }

    @Transactional
    public boolean verifyCode(User user, String code) {
        return tokenRepository.findTopByUserAndUsedFalseOrderByCreatedAtDesc(user)
                .map(token -> {
                    if (token.isExpired()) {
                        log.warn("Código 2FA expirado para: {}", user.getEmail());
                        return false;
                    }
                    if (!token.getCode().equals(code)) {
                        log.warn("Código 2FA incorrecto para: {}", user.getEmail());
                        return false;
                    }
                    token.setUsed(true);
                    tokenRepository.save(token);
                    return true;
                })
                .orElse(false);
    }

    private String generateCode() {
        int code = 100000 + RANDOM.nextInt(900000);
        return String.valueOf(code);
    }

    private void sendEmail(String to, String name, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(to);
        message.setSubject("Código de verificación - Sistema Pollería");
        message.setText(String.format(
                "Hola %s,\n\nTu código de verificación es: %s\n\nExpira en %d minutos.\n\nSi no solicitaste este código, ignora este mensaje.",
                name, code, codeExpiryMinutes
        ));
        mailSender.send(message);
    }
}
