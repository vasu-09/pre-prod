package com.om.Real_Time_Communication.utility;
// imports:
import com.om.Real_Time_Communication.dto.SearchMessageDoc;
import lombok.RequiredArgsConstructor;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.data.elasticsearch.core.query.IndexQueryBuilder;
import org.springframework.stereotype.Component;

@Component
public class ElasticsearchSearchWriter implements SearchWriter {
    private final ElasticsearchOperations es;
    private final java.util.List<SearchMessageDoc> buffer = new java.util.ArrayList<>();

    public ElasticsearchSearchWriter(ElasticsearchOperations es) {
        this.es = es;
    }

    @Override
    public synchronized void enqueue(SearchMessageDoc doc) {
        buffer.add(doc);
        if (buffer.size() >= 1000) flushUnsafe();
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 500)
    public void flush() { synchronized (this) { flushUnsafe(); } }

    private void flushUnsafe() {
        if (buffer.isEmpty()) return;
        var batch = new java.util.ArrayList<>(buffer);
        buffer.clear();

        try {
            java.util.List<IndexQuery> queries = new java.util.ArrayList<>(batch.size());
            for (var d : batch) {
                queries.add(new IndexQueryBuilder()
                        .withId(d.getMessageId())
                        .withObject(d)
                        .build());
            }
            es.bulkIndex(queries, IndexCoordinates.of(SearchMessageDoc.INDEX));
        } catch (Exception e) {
            // simple retry
            buffer.addAll(batch);
        }
    }
}
