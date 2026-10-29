# Ollama SQL explanations

Install Ollama for Windows from https://ollama.com/download/windows and start it.
In PowerShell download a model:

```powershell
ollama pull qwen2.5-coder:3b
```

The backend defaults to `http://127.0.0.1:11434` and `qwen2.5-coder:3b`.
Override `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `backend/.env` if needed,
then restart the backend. For a backend running in Docker, use
`OLLAMA_BASE_URL=http://host.docker.internal:11434` and ensure the container can reach the host service.

Sign in and use **Explain with Ollama** in the SQL editor. The authenticated
`POST /ai/explain` endpoint sends only the SQL text and selected dialect to
the configured Ollama service. It does not send database rows or execute generated SQL.
Replies are advice and need review. First inference can take up to two minutes.
An unavailable service or missing model produces a setup message in the editor.
