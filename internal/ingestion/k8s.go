package ingestion

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/dkapanidis/bobtail/internal/models"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/clientcmd"
)

// FetchK8s discovers all API resources in the cluster and fetches every object,
// returning them as DiscoveredResources ready for sync.
func FetchK8s(source, kubeconfig, kubecontext string) ([]models.DiscoveredResource, error) {
	rules := clientcmd.NewDefaultClientConfigLoadingRules()
	if kubeconfig != "" {
		rules.ExplicitPath = kubeconfig
	}
	config, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		rules,
		&clientcmd.ConfigOverrides{CurrentContext: kubecontext},
	).ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("build kubeconfig: %w", err)
	}

	disc, err := discovery.NewDiscoveryClientForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("create discovery client: %w", err)
	}

	dyn, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("create dynamic client: %w", err)
	}

	// Resolve cluster name from context
	cluster := kubecontext
	if cluster == "" {
		raw, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(rules, &clientcmd.ConfigOverrides{}).RawConfig()
		if err == nil {
			cluster = raw.CurrentContext
		}
	}

	_, apiResourceLists, err := disc.ServerGroupsAndResources()
	if err != nil {
		// Partial results are common (e.g. metrics API unavailable)
		log.Printf("Warning: partial discovery error: %v", err)
	}

	ctx := context.Background()
	var resources []models.DiscoveredResource

	for _, list := range apiResourceLists {
		gv, err := schema.ParseGroupVersion(list.GroupVersion)
		if err != nil {
			continue
		}

		for _, apiRes := range list.APIResources {
			// Skip subresources (e.g. pods/log, deployments/scale)
			if strings.Contains(apiRes.Name, "/") {
				continue
			}
			// Must support list
			if !containsVerb(apiRes.Verbs, "list") {
				continue
			}
			// Skip Secrets
			if strings.EqualFold(apiRes.Kind, "Secret") {
				continue
			}

			gvr := schema.GroupVersionResource{
				Group:    gv.Group,
				Version:  gv.Version,
				Resource: apiRes.Name,
			}

			var items []map[string]any
			if apiRes.Namespaced {
				items, err = listResources(ctx, dyn, gvr, "")
			} else {
				items, err = listResources(ctx, dyn, gvr, "")
			}
			if err != nil {
				log.Printf("Skipping %s: %v", gvr, err)
				continue
			}

			for _, item := range items {
				meta := extractMeta(item)
				namespace := meta["namespace"]
				if namespace == "" {
					namespace = "_cluster_"
				}

				values := Flatten(item)

				resources = append(resources, models.DiscoveredResource{
					Source:    source,
					Cluster:   cluster,
					Namespace: namespace,
					Kind:      apiRes.Kind,
					Name:      meta["name"],
					Values:    values,
				})
			}
		}
	}

	return resources, nil
}

func listResources(ctx context.Context, dyn dynamic.Interface, gvr schema.GroupVersionResource, namespace string) ([]map[string]any, error) {
	var result []map[string]any

	var continueToken string
	for {
		opts := metav1.ListOptions{
			Limit:    500,
			Continue: continueToken,
		}

		var ulist *unstructured.UnstructuredList
		var err error
		if namespace != "" {
			ulist, err = dyn.Resource(gvr).Namespace(namespace).List(ctx, opts)
		} else {
			ulist, err = dyn.Resource(gvr).List(ctx, opts)
		}
		if err != nil {
			return nil, err
		}

		for _, item := range ulist.Items {
			result = append(result, item.Object)
		}

		continueToken = ulist.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return result, nil
}

func extractMeta(obj map[string]any) map[string]string {
	result := map[string]string{}
	meta, ok := obj["metadata"].(map[string]any)
	if !ok {
		return result
	}
	if v, ok := meta["name"].(string); ok {
		result["name"] = v
	}
	if v, ok := meta["namespace"].(string); ok {
		result["namespace"] = v
	}
	return result
}

func containsVerb(verbs []string, target string) bool {
	for _, v := range verbs {
		if v == target {
			return true
		}
	}
	return false
}
