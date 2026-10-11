package com.sistema.polleria.payments.dto;

import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record ReembolsoRequest(
        @Positive(message = "El monto debe ser positivo")
        BigDecimal monto,
        String motivo
) {}
