{{- define "legalos.labels" -}}
app.kubernetes.io/part-of: ai-legal-os
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "legalos.image" -}}
{{- printf "%s/%s:%s" .root.Values.global.imageRegistry .image .root.Values.global.imageTag -}}
{{- end -}}
