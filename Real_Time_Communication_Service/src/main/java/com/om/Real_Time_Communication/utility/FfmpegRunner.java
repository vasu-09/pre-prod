package com.om.Real_Time_Communication.utility;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class FfmpegRunner {

    public record VideoMeta(long durationMs, int width, int height) {}

    private FfmpegRunner(){}

    /** Transcode to H.264 MP4 ~720p, AAC audio. */
    public static void transcode720p(Path in, Path outMp4) {
        run(new ProcessBuilder(
                "ffmpeg", "-y",
                "-i", in.toAbsolutePath().toString(),
                "-vf", "scale='min(1280,iw)':-2",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                outMp4.toAbsolutePath().toString()
        ));
    }

    /** Extract a poster at t=1s. */
    public static void extractPoster(Path in, Path outJpg) {
        run(new ProcessBuilder(
                "ffmpeg", "-y",
                "-ss", "00:00:01",
                "-i", in.toAbsolutePath().toString(),
                "-frames:v", "1",
                "-q:v", "2",
                outJpg.toAbsolutePath().toString()
        ));
    }

    /** Probe width/height/duration using ffprobe (best-effort). */
    public static VideoMeta probe(Path in) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "ffprobe",
                    "-v", "error",
                    "-select_streams", "v:0",
                    "-show_entries", "stream=width,height:format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=0",
                    in.toAbsolutePath().toString()
            );
            Process p = pb.start();
            try (BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                String line;
                int width = 0, height = 0; double duration = 0;
                Pattern w = Pattern.compile("^width=(\\d+)$");
                Pattern h = Pattern.compile("^height=(\\d+)$");
                Pattern d = Pattern.compile("^duration=([0-9.]+)$");
                while ((line = br.readLine()) != null) {
                    Matcher mw = w.matcher(line);
                    Matcher mh = h.matcher(line);
                    Matcher md = d.matcher(line);
                    if (mw.matches()) width = Integer.parseInt(mw.group(1));
                    if (mh.matches()) height = Integer.parseInt(mh.group(1));
                    if (md.matches()) duration = Double.parseDouble(md.group(1));
                }
                p.waitFor();
                long ms = (long) Math.round(duration * 1000.0);
                return new VideoMeta(ms, width, height);
            }
        } catch (Exception e) {
            // Don’t fail the job; just return minimal info
            return new VideoMeta(0, 0, 0);
        }
    }

    private static void run(ProcessBuilder pb) {
        pb.redirectErrorStream(true);
        try {
            Process p = pb.start();
            // drain output to avoid blocking
            try (BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                while (br.readLine() != null) {}
            }
            int code = p.waitFor();
            if (code != 0) throw new IOException("ffmpeg exited " + code);
        } catch (IOException | InterruptedException e) {
            throw new RuntimeException("ffmpeg failed: " + e.getMessage(), e);
        }
    }
}
