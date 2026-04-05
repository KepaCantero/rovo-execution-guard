# CONFLUENCE API RULES

Este directorio contiene reglas exhaustivas para usar las APIs de Confluence durante migraciones y desarrollo.

## Archivos

- **confluence-rest-api-v1.mdc**: 50 reglas para Confluence REST API v1
- **confluence-rest-api-v2.mdc**: 50 reglas para Confluence REST API v2

## Uso

Estas reglas cubren:

- **Auditoría**: Cómo revisar y validar uso correcto de APIs
- **Diseño**: Cómo estructurar código que usa APIs de Confluence
- **Implementación**: Cómo implementar llamadas a APIs correctamente

## Endpoints Principales

### API v1 (`/wiki/rest/api`)

- Content: `/content/{id}`, `/content/{id}/copy`, `/content/{id}/label`
- User: `/user`, `/user/email`, `/user/email/bulk`, `/search/user`
- Space: `/space/{key}`, `/space/{key}/watch`
- Group: `/group/{groupId}/membersByGroupId`
- Properties: `/content/{id}/property/{key}`

### API v2 (`/wiki/api/v2`)

- Spaces: `/spaces`, `/spaces/{id}`, `/spaces/{id}/pages`
- Pages: `/pages/{id}`, `/pages/{id}/ancestors`
- Blogposts: `/blogposts/{id}`
- Properties: `/{contentType}s/{id}/properties`
- Labels: `/{contentType}s/{id}/labels`
- Versions: VersionApi methods
- Operations: `/{contentType}s/{id}/operations`

## Referencias

- [Confluence REST API v1](https://developer.atlassian.com/cloud/confluence/rest/v1/intro/)
- [Confluence REST API v2](https://developer.atlassian.com/cloud/confluence/rest/v2/intro/)
