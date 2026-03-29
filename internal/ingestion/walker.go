package ingestion

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/dkapanidis/bobtail/internal/models"
	"gopkg.in/yaml.v3"
)

func Walk(source, root string) ([]models.DiscoveredResource, error) {
	var resources []models.DiscoveredResource

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		ext := filepath.Ext(path)
		if info.IsDir() || (ext != ".yaml" && ext != ".json") {
			return nil
		}

		rel, err := filepath.Rel(root, path)
		if err != nil {
			return fmt.Errorf("relative path: %w", err)
		}

		// Expected: cluster/namespace/kind/name.yaml
		parts := strings.Split(rel, string(filepath.Separator))
		if len(parts) != 4 {
			return nil // skip files not matching expected depth
		}

		cluster := parts[0]
		namespace := parts[1]
		kind := parts[2]
		name := strings.TrimSuffix(parts[3], ext)

		// Never ingest Secrets — they contain sensitive data
		if strings.EqualFold(kind, "Secret") {
			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read %s: %w", path, err)
		}

		var parsed map[string]any
		switch ext {
		case ".json":
			if err := json.Unmarshal(data, &parsed); err != nil {
				return fmt.Errorf("parse %s: %w", path, err)
			}
		default:
			if err := yaml.Unmarshal(data, &parsed); err != nil {
				return fmt.Errorf("parse %s: %w", path, err)
			}
		}

		values := Flatten(parsed)

		resources = append(resources, models.DiscoveredResource{
			Source:    source,
			Cluster:   cluster,
			Namespace: namespace,
			Kind:      kind,
			Name:      name,
			Values:    values,
		})

		return nil
	})

	return resources, err
}
