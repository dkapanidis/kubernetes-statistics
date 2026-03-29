package ingestion

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/dkapanidis/bobtail/internal/models"
	"gopkg.in/yaml.v3"
)

var defaultSkipPrefixes = []string{
	"metadata.resourceVersion",
	"metadata.uid",
	"metadata.generation",
	"metadata.creationTimestamp",
	"metadata.managedFields",
	"status.conditions.lastTransitionTime",
	"status.conditions.lastProbeTime",
}

func shouldSkip(key string) bool {
	for _, prefix := range defaultSkipPrefixes {
		if key == prefix || strings.HasPrefix(key, prefix+".") || strings.HasPrefix(key, prefix+"[") {
			return true
		}
	}
	return false
}

// Flatten flattens a parsed map into key-value pairs (no line info).
func Flatten(data map[string]interface{}) map[string]models.FlatValue {
	result := make(map[string]models.FlatValue)
	flattenRecursive("", data, result)
	return result
}

func flattenRecursive(prefix string, data interface{}, result map[string]models.FlatValue) {
	switch v := data.(type) {
	case map[string]interface{}:
		for key, val := range v {
			newKey := key
			if prefix != "" {
				newKey = prefix + "." + key
			}
			flattenRecursive(newKey, val, result)
		}
	case map[interface{}]interface{}:
		for key, val := range v {
			keyStr := fmt.Sprintf("%v", key)
			newKey := keyStr
			if prefix != "" {
				newKey = prefix + "." + keyStr
			}
			flattenRecursive(newKey, val, result)
		}
	case []interface{}:
		for i, val := range v {
			newKey := fmt.Sprintf("%s[%d]", prefix, i)
			flattenRecursive(newKey, val, result)
		}
	default:
		if shouldSkip(prefix) {
			return
		}
		strVal := fmt.Sprintf("%v", v)
		if v == nil {
			strVal = ""
		}
		fv := models.FlatValue{Value: strVal}
		parseTypedValues(strVal, &fv)
		result[prefix] = fv
	}
}

// FlattenNode flattens a yaml.Node tree, preserving line numbers.
func FlattenNode(node *yaml.Node) map[string]models.FlatValue {
	result := make(map[string]models.FlatValue)
	// The top-level node from yaml.v3 Decoder is a document node
	if node.Kind == yaml.DocumentNode && len(node.Content) > 0 {
		node = node.Content[0]
	}
	flattenNodeRecursive("", node, result)
	return result
}

func flattenNodeRecursive(prefix string, node *yaml.Node, result map[string]models.FlatValue) {
	switch node.Kind {
	case yaml.MappingNode:
		// Content is [key, value, key, value, ...]
		for i := 0; i+1 < len(node.Content); i += 2 {
			keyNode := node.Content[i]
			valNode := node.Content[i+1]
			key := keyNode.Value
			newKey := key
			if prefix != "" {
				newKey = prefix + "." + key
			}
			flattenNodeRecursive(newKey, valNode, result)
		}
	case yaml.SequenceNode:
		for i, child := range node.Content {
			newKey := fmt.Sprintf("%s[%d]", prefix, i)
			flattenNodeRecursive(newKey, child, result)
		}
	case yaml.ScalarNode:
		if shouldSkip(prefix) {
			return
		}
		strVal := node.Value
		fv := models.FlatValue{Value: strVal, Line: node.Line}
		parseTypedValues(strVal, &fv)
		result[prefix] = fv
	case yaml.AliasNode:
		if node.Alias != nil {
			flattenNodeRecursive(prefix, node.Alias, result)
		}
	}
}

// flattenWithLines marshals a map to YAML and re-parses as yaml.Node to get line numbers.
func flattenWithLines(data map[string]any) map[string]models.FlatValue {
	raw, err := yaml.Marshal(data)
	if err != nil {
		return Flatten(data)
	}
	var node yaml.Node
	if err := yaml.Unmarshal(raw, &node); err != nil {
		return Flatten(data)
	}
	return FlattenNode(&node)
}

func parseTypedValues(s string, fv *models.FlatValue) {
	if i, err := strconv.ParseInt(s, 10, 64); err == nil {
		fv.ValueInt = &i
		return
	}
	if f, err := strconv.ParseFloat(s, 64); err == nil {
		fv.ValueFloat = &f
		return
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		fv.ValueTime = &t
		return
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		fv.ValueTime = &t
		return
	}
}
