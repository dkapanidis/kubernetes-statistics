package models

import "time"

type Resource struct {
	ID        int64     `json:"id"`
	Cluster   string    `json:"cluster"`
	Namespace string    `json:"namespace"`
	Kind      string    `json:"kind"`
	Name      string    `json:"name"`
	FirstSeen time.Time `json:"firstSeen"`
	LastSeen  time.Time `json:"lastSeen"`
}

type ResourceValue struct {
	ID         int64      `json:"id"`
	ResourceID int64      `json:"resourceId"`
	Key        string     `json:"key"`
	Value      string     `json:"value"`
	ValueInt   *int64     `json:"valueInt,omitempty"`
	ValueFloat *float64   `json:"valueFloat,omitempty"`
	ValueTime  *time.Time `json:"valueTime,omitempty"`
	FirstSeen  time.Time  `json:"firstSeen"`
	LastSeen   time.Time  `json:"lastSeen"`
}

type FlatValue struct {
	Value      string
	ValueInt   *int64
	ValueFloat *float64
	ValueTime  *time.Time
	Line       int
}

type DiscoveredResource struct {
	Source    string
	Cluster   string
	Namespace string
	Kind      string
	Name      string
	Values    map[string]FlatValue
}
