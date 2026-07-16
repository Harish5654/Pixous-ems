package com.pixous.hrportal.modules.file;

import com.pixous.hrportal.common.StorageService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Serves stored files (profile photos, receipts, etc.) as raw bytes so they can
 * be used directly in {@code <img src>} tags. Public (permitAll) because image
 * requests from the browser don't carry the JWT Authorization header; stored
 * paths are UUID-based and unguessable.
 */
@RestController
@RequestMapping("/api/files")
public class FileController {

    private static final String PREFIX = "/api/files/";

    private final StorageService storageService;

    public FileController(StorageService storageService) {
        this.storageService = storageService;
    }

    @GetMapping("/**")
    public ResponseEntity<Resource> serve(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String relative = uri.length() > PREFIX.length() ? uri.substring(PREFIX.length()) : "";
        relative = URLDecoder.decode(relative, StandardCharsets.UTF_8);

        // Prevent path traversal outside the storage root.
        if (relative.isBlank() || relative.contains("..")) {
            return ResponseEntity.badRequest().build();
        }

        byte[] bytes = storageService.read(relative); // throws 404 if missing
        MediaType contentType = MediaTypeFactory.getMediaType(relative)
                .orElse(MediaType.APPLICATION_OCTET_STREAM);

        return ResponseEntity.ok()
                .contentType(contentType)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                .body(new ByteArrayResource(bytes));
    }
}
