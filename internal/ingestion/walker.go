package ingestion

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/dkapanidis/kubernetes-statistics/internal/models"
	"gopkg.in/yaml.v3"
)

func Walk(root string) ([]models.DiscoveredResource, error) {
	var resources []models.DiscoveredResource

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || !strings.HasSuffix(path, ".yaml") {
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
		name := strings.TrimSuffix(parts[3], ".yaml")

		// Never ingest Secrets — they contain sensitive data
		if strings.EqualFold(kind, "Secret") {
			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read %s: %w", path, err)
		}

		var parsed map[string]any
		if err := yaml.Unmarshal(data, &parsed); err != nil {
			return fmt.Errorf("parse %s: %w", path, err)
		}

		values := Flatten(parsed)

		resources = append(resources, models.DiscoveredResource{
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
