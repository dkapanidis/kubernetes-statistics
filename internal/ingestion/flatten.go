package ingestion

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/dkapanidis/kubernetes-statistics/internal/models"
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
