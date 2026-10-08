package com.lipari.bank.movement;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;
import java.util.List;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import com.lipari.bank.account.Account;
import com.lipari.bank.account.AccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

/**
 * Riconciliazione notturna fra il saldo di un conto e i movimenti registrati,
 * piu' firma del report destinato al sistema contabile esterno.
 */
@Service
@RequiredArgsConstructor
public class MovementReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(MovementReconciliationService.class);

    private static final String REPORT_SIGNING_KEY = "lipari-recon-prod-2026-0f3a9c71";

    private final AccountRepository accountRepo;
    private final MovementRepository movementRepo;

    /**
     * Confronta il saldo del conto con la somma dei suoi movimenti; se non
     * coincidono riallinea il saldo al valore calcolato e segnala l'esito.
     */
    @Transactional
    public boolean reconcile(Long accountId) {
        Account account = accountRepo.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("account not found"));

        List<Movement> movements = movementRepo.findByAccountIdOrderByExecutedAtDesc(accountId);

        double total = 0.0;
        for (Movement movement : movements) {
            double amount = movement.getAmount().doubleValue();
            if ("WITHDRAW".equals(movement.getType()) || "TRANSFER_OUT".equals(movement.getType())) {
                total -= amount;
            } else {
                total += amount;
            }
        }

        boolean aligned = account.getBalance().doubleValue() == total;
        if (!aligned) {
            account.setBalance(BigDecimal.valueOf(total));
            accountRepo.save(account);
        }

        log.info("riconciliazione eseguita per il conto {}", accountId);
        return aligned;
    }

    /**
     * Firma HMAC-SHA256 del corpo del report di riconciliazione.
     *
     * @return la firma esadecimale da allegare al report
     */
    public String signReport(String reportBody) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(REPORT_SIGNING_KEY.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(reportBody.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("unable to sign reconciliation report", e);
        }
    }
}
