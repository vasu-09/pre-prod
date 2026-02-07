package com.om.Real_Time_Communication.utility;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.Objects;

public final class ImageIOUtils {

    public record Size(int width, int height) {}

    private ImageIOUtils() {}

    /** Downscale a JPEG/PNG/etc to targetWidth (keep aspect), return JPEG bytes. */
    public static byte[] downscaleJpeg(byte[] input, int targetWidth) {
        Objects.requireNonNull(input, "image bytes");
        try (ByteArrayInputStream in = new ByteArrayInputStream(input);
             ByteArrayOutputStream out = new ByteArrayOutputStream(16 * 1024)) {

            BufferedImage src = ImageIO.read(in);
            if (src == null) throw new IOException("Unsupported image format");
            int w = src.getWidth(), h = src.getHeight();
            if (w <= targetWidth) {
                // already small; just re-encode as JPEG
                ImageIO.write(src, "jpeg", out);
                return out.toByteArray();
            }
            int newW = targetWidth;
            int newH = (int) Math.round(h * (newW / (double) w));

            BufferedImage dst = new BufferedImage(newW, newH, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = dst.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.drawImage(src, 0, 0, newW, newH, null);
            g.dispose();

            ImageIO.write(dst, "jpeg", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("downscaleJpeg failed", e);
        }
    }

    /** Detect pixel size of an image (no scaling). */
    public static Size detectSize(byte[] input) {
        Objects.requireNonNull(input, "image bytes");
        try (ByteArrayInputStream in = new ByteArrayInputStream(input)) {
            BufferedImage src = ImageIO.read(in);
            if (src == null) throw new IOException("Unsupported image");
            return new Size(src.getWidth(), src.getHeight());
        } catch (IOException e) {
            throw new RuntimeException("detectSize failed", e);
        }
    }
}