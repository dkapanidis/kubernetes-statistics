package api

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed dist/*
var frontendFS embed.FS

func frontendHandler() http.Handler {
	sub, err := fs.Sub(frontendFS, "dist")
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to serve the file directly; fall back to index.html for SPA routing
		f, err := sub.Open(r.URL.Path[1:]) // strip leading /
		if err != nil {
			r.URL.Path = "/"
		} else {
			f.Close()
		}
		fileServer.ServeHTTP(w, r)
	})
}
