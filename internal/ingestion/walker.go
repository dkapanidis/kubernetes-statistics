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

// ParsePattern splits a path pattern like "testdata/:cluster/:namespace/:kind/"
// into a root directory (literal prefix) and dynamic segment names.
// The filename (minus extension) is always used as the resource name.
func ParsePattern(pattern string) (root string, segments []string) {
	pattern = filepath.Clean(pattern)
	parts := strings.Split(pattern, string(filepath.Separator))

	// Literal prefix becomes root
	var rootParts []string
	i := 0
	for ; i < len(parts); i++ {
		if strings.HasPrefix(parts[i], ":") {
			break
		}
		rootParts = append(rootParts, parts[i])
	}
	root = filepath.Join(rootParts...)
	if root == "" {
		root = "."
	}

	// Remaining parts are dynamic segment names (strip leading ':')
	for ; i < len(parts); i++ {
		segments = append(segments, strings.TrimPrefix(parts[i], ":"))
	}

	return root, segments
}

func extractNestedString(m map[string]any, keys ...string) string {
	var current any = m
	for _, k := range keys {
		obj, ok := current.(map[string]any)
		if !ok {
			return ""
		}
		current = obj[k]
	}
	s, _ := current.(string)
	return s
}

func Walk(source, pattern string) ([]models.DiscoveredResource, error) {
	root, segments := ParsePattern(pattern)
	expectedDepth := len(segments) + 1 // segments + filename

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

		parts := strings.Split(rel, string(filepath.Separator))
		if len(parts) != expectedDepth {
			return nil // skip files not matching expected depth
		}

		// Map dynamic segments to fields
		fields := make(map[string]string)
		for i, seg := range segments {
			fields[seg] = parts[i]
		}
		fields["name"] = strings.TrimSuffix(parts[len(parts)-1], ext)

		cluster := fields["cluster"]
		namespace := fields["namespace"]
		kind := fields["kind"]
		name := fields["name"]

		// Never ingest Secrets — they contain sensitive data
		if strings.EqualFold(kind, "Secret") {
			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read %s: %w", path, err)
		}

		var values map[string]models.FlatValue
		var parsed map[string]any
		switch ext {
		case ".json":
			if err := json.Unmarshal(data, &parsed); err != nil {
				return fmt.Errorf("parse %s: %w", path, err)
			}
			values = Flatten(parsed)
		default:
			var node yaml.Node
			if err := yaml.Unmarshal(data, &node); err != nil {
				return fmt.Errorf("parse %s: %w", path, err)
			}
			values = FlattenNode(&node)
			// Also unmarshal into map for extracting resource-level fields
			if err := yaml.Unmarshal(data, &parsed); err != nil {
				return fmt.Errorf("parse %s: %w", path, err)
			}
		}

		if parsed == nil {
			parsed = make(map[string]any)
		}

		// Extract resource-level fields from the object itself
		objKind, _ := parsed["kind"].(string)
		objName := extractNestedString(parsed, "metadata", "name")
		objNamespace := extractNestedString(parsed, "metadata", "namespace")

		// Object fields take priority; path fields fill gaps
		if objKind != "" {
			if kind != "" && kind != objKind {
				fmt.Fprintf(os.Stderr, "WARNING: path kind %q != object kind %q for %s\n", kind, objKind, path)
			}
			kind = objKind
		}
		if objName != "" {
			name = objName
		}
		if objNamespace != "" {
			namespace = objNamespace
		}

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
