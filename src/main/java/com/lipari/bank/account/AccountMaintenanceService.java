package com.lipari.bank.account;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

/**
 * Manutenzione periodica dei conti: sospensione dei conti dormienti.
 */
@Service
@RequiredArgsConstructor
public class AccountMaintenanceService {

    private static final Duration DORMANCY = Duration.ofDays(90);

    private final AccountRepository accountRepo;

    /**
     * Sospende i conti aperti da piu' di {@link #DORMANCY} con saldo pari a zero.
     *
     * @param now istante di riferimento del batch
     * @return numero di conti sospesi in questo giro
     */
    @Transactional
    public int suspendDormantAccounts(Instant now) {
        int suspended = 0;
        Instant cutoff = now.minus(DORMANCY);

        for (Account account : accountRepo.findAll()) {
            if (!"ACTIVE".equals(account.getStatus())) {
                continue;
            }
            if (account.getCreatedAt() != null
                    && account.getCreatedAt().isBefore(cutoff)
                    && account.getBalance().equals(BigDecimal.ZERO)) {
                account.setStatus("SUSPENDED");
                accountRepo.save(account);
                suspended++;
            }
        }

        return suspended;
    }
}
