package com.pixous.hrportal.common;

import com.pixous.hrportal.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

/**
 * Sends SMS via the Twilio REST API using the JDK HTTP client (no extra
 * dependency). Fire-and-forget: runs async and never throws to the caller, so
 * a delivery failure never blocks or breaks the business action that triggered it.
 */
@Slf4j
@Service
public class SmsService {

    private final AppProperties props;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10)).build();

    public SmsService(AppProperties props) {
        this.props = props;
    }

    /** Normalise a raw phone number to E.164 (e.g. "9047699216" -> "+919047699216"). */
    public String toE164(String raw) {
        if (raw == null) return null;
        String cleaned = raw.replaceAll("[^0-9+]", "");
        if (cleaned.isEmpty()) return null;
        if (cleaned.startsWith("+")) return cleaned;
        cleaned = cleaned.replaceFirst("^0+", "");
        String cc = props.twilio() != null && props.twilio().defaultCountryCode() != null
                ? props.twilio().defaultCountryCode() : "+91";
        if (cleaned.length() == 10) return cc + cleaned;
        return "+" + cleaned; // already includes a country code
    }

    @Async
    public void send(String toRaw, String body) {
        AppProperties.Twilio tw = props.twilio();
        if (tw == null || !tw.enabled()) {
            log.info("SMS disabled — skipping message to {}", toRaw);
            return;
        }
        if (tw.accountSid() == null || tw.accountSid().isBlank()
                || tw.authToken() == null || tw.authToken().isBlank()) {
            log.warn("SMS skipped — Twilio credentials not configured");
            return;
        }
        String to = toE164(toRaw);
        if (to == null) {
            log.warn("SMS skipped — recipient has no valid phone number");
            return;
        }
        try {
            String form = "To=" + enc(to) + "&From=" + enc(tw.fromNumber()) + "&Body=" + enc(body);
            String basic = Base64.getEncoder().encodeToString(
                    (tw.accountSid() + ":" + tw.authToken()).getBytes(StandardCharsets.UTF_8));
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.twilio.com/2010-04-01/Accounts/"
                            + tw.accountSid() + "/Messages.json"))
                    .header("Authorization", "Basic " + basic)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(form))
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                log.info("SMS sent to {} (Twilio HTTP {})", to, resp.statusCode());
            } else {
                log.warn("SMS to {} failed — Twilio HTTP {}: {}", to, resp.statusCode(), resp.body());
            }
        } catch (Exception e) {
            log.error("SMS send error to {}: {}", to, e.getMessage());
        }
    }

    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }
}
