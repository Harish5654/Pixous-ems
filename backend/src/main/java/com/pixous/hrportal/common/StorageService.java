package com.pixous.hrportal.common;

import com.pixous.hrportal.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Local-disk storage for documents, photos, payslips, QR images, etc.
 * The {@code app.storage.type} switch leaves room for an S3/MinIO impl in prod
 * without touching callers.
 */
@Slf4j
@Service
public class StorageService {

    private final Path root;

    public StorageService(AppProperties props) {
        this.root = Paths.get(props.storage().localPath()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new IllegalStateException("Could not create storage root " + root, e);
        }
    }

    /** Stores a multipart upload under {@code <folder>/<yyyy-MM>/<uuid>.<ext>} and returns the relative path. */
    public String store(MultipartFile file, String folder) {
        if (file == null || file.isEmpty()) {
            throw ApiException.business("File is empty");
        }
        String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
        String ext = original.contains(".") ? original.substring(original.lastIndexOf('.') + 1) : "bin";
        String relative = folder + "/" + LocalDate.now().toString().substring(0, 7)
                + "/" + UUID.randomUUID() + "." + ext;
        try {
            Path target = root.resolve(relative).normalize();
            Files.createDirectories(target.getParent());
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return relative;
        } catch (IOException e) {
            log.error("Failed to store file", e);
            throw new ApiException(ErrorCode.INTERNAL, "Could not store file");
        }
    }

    /** Writes raw bytes (e.g. a generated PDF / QR png) and returns the relative path. */
    public String storeBytes(byte[] content, String folder, String filename) {
        String relative = folder + "/" + filename;
        try {
            Path target = root.resolve(relative).normalize();
            Files.createDirectories(target.getParent());
            Files.write(target, content);
            return relative;
        } catch (IOException e) {
            throw new ApiException(ErrorCode.INTERNAL, "Could not write file");
        }
    }

    public byte[] read(String relativePath) {
        try {
            return Files.readAllBytes(root.resolve(relativePath).normalize());
        } catch (IOException e) {
            throw ApiException.notFound("File");
        }
    }

    public Path resolve(String relativePath) {
        return root.resolve(relativePath).normalize();
    }
}
