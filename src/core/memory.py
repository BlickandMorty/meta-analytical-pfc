"""Cross-chat memory — ChromaDB vector store for semantic retrieval."""

from typing import Dict, List, Optional
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer


class CrossChatMemory:
    """Persistent semantic memory across conversations using ChromaDB."""

    def __init__(self, config: Dict):
        persist_dir = Path(config.get("path", "data/memory"))
        persist_dir.mkdir(parents=True, exist_ok=True)

        try:
            self.client = chromadb.PersistentClient(path=str(persist_dir))
        except Exception:
            from chromadb.config import Settings
            self.client = chromadb.Client(Settings(
                chroma_db_impl="duckdb+parquet",
                persist_directory=str(persist_dir),
            ))

        self.collection = self.client.get_or_create_collection(
            name="conversation_memory",
            metadata={"description": "PFC conversation history"},
        )

        model_name = config.get("embedding_model", "all-MiniLM-L6-v2")
        self.embedder = SentenceTransformer(model_name)
        self.similarity_threshold = config.get("similarity_threshold", 0.75)
        self.max_results = config.get("max_context_length", 10)

    def store(self, query: str, response: str, reasoning_trace: Dict, mode: str, user_id: Optional[str] = None):
        embedding = self.embedder.encode(query).tolist()
        existing = self.collection.get()
        doc_id = f"{user_id or 'default'}_{len(existing['ids'])}"
        self.collection.add(
            embeddings=[embedding],
            documents=[query],
            metadatas=[{"mode": mode, "user_id": user_id or "default", "response_preview": response[:200]}],
            ids=[doc_id],
        )

    def retrieve_relevant(self, query: str, user_id: Optional[str] = None, k: int = 5) -> List[Dict]:
        embedding = self.embedder.encode(query).tolist()
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=min(k, self.max_results),
            where={"user_id": user_id} if user_id else None,
        )
        memories = []
        if results["ids"][0]:
            for i, _ in enumerate(results["ids"][0]):
                similarity = 1 - results["distances"][0][i]
                if similarity >= self.similarity_threshold:
                    memories.append({
                        "query": results["documents"][0][i],
                        "response": results["metadatas"][0][i]["response_preview"],
                        "mode": results["metadatas"][0][i]["mode"],
                        "similarity": similarity,
                    })
        return memories
