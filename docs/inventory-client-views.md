# Danh sách view JS tùy biến trong clientDefs

Sinh tự động bởi `scripts/inventory-client-views.mjs` từ `D:\Espocrm\EspoCRM-10.0.9`. Không sửa tay.

Tổng: 459 tham chiếu, 280 module JS khác nhau, 78 scope.

## Theo module JS

Module dùng ở nhiều scope thường là hành vi chung, nên làm trong engine; module chỉ dùng ở một scope thường thuộc `overrides/<Scope>/`.

| Module JS | Số scope | Scope |
|---|---|---|
| `controllers/record` | 45 | Account, ActionHistoryRecord, AddressCountry, AppLogRecord, AppSecret, Attachment, AuthLogRecord, AuthToken, AuthenticationProvider, Call, Campaign, CampaignTrackingUrl, Case, Contact, CurrencyRecord, CurrencyRecordRate, DashboardTemplate, Document, EmailAccount, EmailAddress, EmailFolder, EmailQueueItem, EmailTemplate, GroupEmailFolder, ImportError, KnowledgeBaseArticle, LeadCapture, MassEmail, Meeting, OAuthAccount, OAuthProvider, Opportunity, PhoneNumber, Pipeline, PipelineStage, Portal, ScheduledJob, ScheduledJobLogRecord, TargetList, Template, Webhook, WebhookEventQueueItem, WebhookQueueItem, WorkingTimeCalendar, WorkingTimeRange |
| `controllers/record-tree` | 4 | DocumentFolder, EmailTemplateCategory, KnowledgeBaseCategory, TargetListCategory |
| `crm:views/record/panels/target-lists` | 4 | Account, Contact, Lead, User |
| `crm:views/record/row-actions/relationship-target` | 4 | Account, Contact, Lead, User |
| `handlers/select-related/same-account-many` | 4 | Call, Case, Meeting, Opportunity |
| `views/record/row-actions/relationship-unlink-only` | 4 | LayoutSet, Portal, PortalRole, Role |
| `views/record/row-actions/remove-only` | 4 | Campaign, EmailAccount, GroupEmailFolder, InboundEmail |
| `views/record/row-actions/empty` | 3 | Account, Contact, Lead |
| `views/user/detail` | 3 | ApiUser, PortalUser, User |
| `views/user/record/detail` | 3 | ApiUser, PortalUser, User |
| `views/user/record/detail-quick` | 3 | ApiUser, PortalUser, User |
| `views/user/record/edit` | 3 | ApiUser, PortalUser, User |
| `views/user/record/edit-quick` | 3 | ApiUser, PortalUser, User |
| `views/user/record/list` | 3 | ApiUser, PortalUser, User |
| `crm:acl/campaign-tracking-url` | 2 | CampaignLogRecord, CampaignTrackingUrl |
| `crm:handlers/event/reminders-handler` | 2 | Call, Meeting |
| `crm:views/meeting/modals/detail` | 2 | Call, Meeting |
| `crm:views/meeting/record/panels/attendees` | 2 | Call, Meeting |
| `crm:views/meeting/record/panels/scheduler` | 2 | Call, Meeting |
| `handlers/create-related/set-parent` | 2 | Contact, Lead |
| `handlers/email-account/reset-fetch-data-action` | 2 | EmailAccount, InboundEmail |
| `views/email-folder/record/edit-small` | 2 | EmailFolder, GroupEmailFolder |
| `views/modals/select-records-with-categories` | 2 | EmailTemplate, TargetList |
| `views/record/row-actions/relationship-edit-and-remove` | 2 | EmailAccount, InboundEmail |
| `views/record/row-actions/relationship-view-only` | 2 | AuthLogRecord, AuthToken |
| `acl-portal/notification` | 1 | Notification |
| `acl-portal/preferences` | 1 | Preferences |
| `acl/currency-record-rate` | 1 | CurrencyRecordRate |
| `acl/email` | 1 | Email |
| `acl/foreign` | 1 | ImportError |
| `acl/import` | 1 | Import |
| `acl/notification` | 1 | Notification |
| `acl/preferences` | 1 | Preferences |
| `acl/team` | 1 | Team |
| `acl/user` | 1 | User |
| `controllers/address-map` | 1 | AddressMap |
| `controllers/api-user` | 1 | ApiUser |
| `controllers/dashboard` | 1 | Dashboard |
| `controllers/email` | 1 | Email |
| `controllers/email-filter` | 1 | EmailFilter |
| `controllers/external-account` | 1 | ExternalAccount |
| `controllers/global-stream` | 1 | GlobalStream |
| `controllers/import` | 1 | Import |
| `controllers/last-viewed` | 1 | LastViewed |
| `controllers/layout-set` | 1 | LayoutSet |
| `controllers/note` | 1 | Note |
| `controllers/notification` | 1 | Notification |
| `controllers/password-change-request` | 1 | PasswordChangeRequest |
| `controllers/portal-user` | 1 | PortalUser |
| `controllers/stream` | 1 | Stream |
| `controllers/user` | 1 | User |
| `crm:acl-portal/account` | 1 | Account |
| `crm:acl-portal/contact` | 1 | Contact |
| `crm:acl-portal/document` | 1 | Document |
| `crm:acl/call` | 1 | Call |
| `crm:acl/mass-email` | 1 | MassEmail |
| `crm:acl/meeting` | 1 | Meeting |
| `crm:controllers/activities` | 1 | Activities |
| `crm:controllers/lead` | 1 | Lead |
| `crm:controllers/task` | 1 | Task |
| `crm:handlers/campaign/mass-emails-create` | 1 | Campaign |
| `crm:handlers/case/detail-actions` | 1 | Case |
| `crm:handlers/knowledge-base-article/move` | 1 | KnowledgeBaseArticle |
| `crm:handlers/knowledge-base-article/send-in-email` | 1 | KnowledgeBaseArticle |
| `crm:handlers/opportunity/contacts-create` | 1 | Opportunity |
| `crm:handlers/opportunity/defaults-preparator` | 1 | Opportunity |
| `crm:handlers/task/reminders-handler` | 1 | Task |
| `crm:views/account/detail` | 1 | Account |
| `crm:views/call/detail` | 1 | Call |
| `crm:views/call/record/detail` | 1 | Call |
| `crm:views/call/record/edit-small` | 1 | Call |
| `crm:views/call/record/list` | 1 | Call |
| `crm:views/campaign-tracking-url/record/edit` | 1 | CampaignTrackingUrl |
| `crm:views/campaign-tracking-url/record/edit-small` | 1 | CampaignTrackingUrl |
| `crm:views/campaign/detail` | 1 | Campaign |
| `crm:views/campaign/record/detail` | 1 | Campaign |
| `crm:views/campaign/record/panels/campaign-log-records` | 1 | Campaign |
| `crm:views/campaign/record/panels/campaign-stats` | 1 | Campaign |
| `crm:views/case/record/detail` | 1 | Case |
| `crm:views/case/record/panels/activities` | 1 | Case |
| `crm:views/contact/detail` | 1 | Contact |
| `crm:views/contact/record/detail` | 1 | Contact |
| `crm:views/contact/record/detail-small` | 1 | Contact |
| `crm:views/document/list` | 1 | Document |
| `crm:views/document/modals/select-records` | 1 | Document |
| `crm:views/email-queue-item/list` | 1 | EmailQueueItem |
| `crm:views/email-queue-item/record/list` | 1 | EmailQueueItem |
| `crm:views/knowledge-base-article/list` | 1 | KnowledgeBaseArticle |
| `crm:views/knowledge-base-article/modals/select-records` | 1 | KnowledgeBaseArticle |
| `crm:views/knowledge-base-article/record/detail` | 1 | KnowledgeBaseArticle |
| `crm:views/knowledge-base-article/record/detail-quick` | 1 | KnowledgeBaseArticle |
| `crm:views/knowledge-base-article/record/edit` | 1 | KnowledgeBaseArticle |
| `crm:views/knowledge-base-article/record/edit-quick` | 1 | KnowledgeBaseArticle |
| `crm:views/knowledge-base-article/record/list` | 1 | KnowledgeBaseArticle |
| `crm:views/lead/detail` | 1 | Lead |
| `crm:views/lead/record/detail` | 1 | Lead |
| `crm:views/lead/record/panels/converted-to` | 1 | Lead |
| `crm:views/mass-email/detail` | 1 | MassEmail |
| `crm:views/mass-email/record/detail` | 1 | MassEmail |
| `crm:views/mass-email/record/edit` | 1 | MassEmail |
| `crm:views/mass-email/record/edit-small` | 1 | MassEmail |
| `crm:views/mass-email/record/list-for-campaign` | 1 | Campaign |
| `crm:views/mass-email/record/row-actions/for-campaign` | 1 | Campaign |
| `crm:views/meeting/detail` | 1 | Meeting |
| `crm:views/meeting/record/detail` | 1 | Meeting |
| `crm:views/meeting/record/edit-small` | 1 | Meeting |
| `crm:views/meeting/record/list` | 1 | Meeting |
| `crm:views/notification/items/event-attendee` | 1 | Notification |
| `crm:views/opportunity/detail` | 1 | Opportunity |
| `crm:views/opportunity/record/edit` | 1 | Opportunity |
| `crm:views/opportunity/record/edit-small` | 1 | Opportunity |
| `crm:views/opportunity/record/kanban` | 1 | Opportunity |
| `crm:views/opportunity/record/list` | 1 | Opportunity |
| `crm:views/opportunity/record/panels/activities` | 1 | Opportunity |
| `crm:views/stream/notes/event-confirmation` | 1 | Note |
| `crm:views/target-list/record/detail` | 1 | TargetList |
| `crm:views/target-list/record/panels/opted-out` | 1 | TargetList |
| `crm:views/target-list/record/panels/relationship` | 1 | TargetList |
| `crm:views/target-list/record/row-actions/default` | 1 | TargetList |
| `crm:views/task/detail` | 1 | Task |
| `crm:views/task/list` | 1 | Task |
| `crm:views/task/record/detail` | 1 | Task |
| `crm:views/task/record/list` | 1 | Task |
| `crm:views/user/record/panels/tasks` | 1 | User |
| `handlers/admin/address-country/populate-defaults` | 1 | AddressCountry |
| `handlers/api-user/open-api-spec-action` | 1 | ApiUser |
| `handlers/currency-record-rate/default-preparator` | 1 | CurrencyRecordRate |
| `handlers/currency-record/menu-action-settings` | 1 | CurrencyRecord |
| `handlers/currency-record/record-detail` | 1 | CurrencyRecord |
| `handlers/email-filter` | 1 | EmailFilter |
| `handlers/email/list-actions` | 1 | Email |
| `handlers/email/select-user` | 1 | Email |
| `handlers/import` | 1 | Import |
| `handlers/lead-capture/pipeline-select-handler` | 1 | LeadCapture |
| `handlers/lead-capture/record-detail-view-setup` | 1 | LeadCapture |
| `handlers/note/record-detail-setup` | 1 | Note |
| `handlers/pipeline-stage/move-row-action` | 1 | PipelineStage |
| `handlers/pipeline/move-row-action` | 1 | Pipeline |
| `handlers/record/lock-action` | 1 | Global |
| `handlers/record/lock-mass-action` | 1 | Global |
| `handlers/record/lock-view-setup` | 1 | Global |
| `handlers/record/pipeline-view-setup` | 1 | Global |
| `handlers/record/view-audit-log` | 1 | Global |
| `handlers/record/view-user-access` | 1 | Global |
| `handlers/select-related/same-account` | 1 | Contact |
| `handlers/user/change-team-position-row-action` | 1 | User |
| `handlers/user/select-contact` | 1 | User |
| `handlers/working-time-range` | 1 | WorkingTimeRange |
| `views/action-history-record/modals/detail` | 1 | ActionHistoryRecord |
| `views/action-history-record/record/list` | 1 | ActionHistoryRecord |
| `views/admin/app-log-record/record/list` | 1 | AppLogRecord |
| `views/admin/auth-log-record/modals/detail` | 1 | AuthLogRecord |
| `views/admin/auth-log-record/record/detail` | 1 | AuthLogRecord |
| `views/admin/auth-log-record/record/detail-small` | 1 | AuthLogRecord |
| `views/admin/auth-log-record/record/list` | 1 | AuthLogRecord |
| `views/admin/auth-token/modals/detail` | 1 | AuthToken |
| `views/admin/auth-token/record/detail` | 1 | AuthToken |
| `views/admin/auth-token/record/detail-small` | 1 | AuthToken |
| `views/admin/auth-token/record/list` | 1 | AuthToken |
| `views/admin/dynamic-logic/conditions-string/group-base` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions-string/group-not` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions-string/item-base` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions-string/item-in-future` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions-string/item-in-past` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions-string/item-is-today` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions-string/item-multiple-values-base` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions-string/item-operator-only-base` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions-string/item-value-enum` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions-string/item-value-link` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions-string/item-value-varchar` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions/field-types/base` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions/field-types/current-user` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions/field-types/current-user-teams` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions/field-types/date` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions/field-types/enum` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions/field-types/link` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions/field-types/link-multiple` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions/field-types/link-parent` | 1 | DynamicLogic |
| `views/admin/dynamic-logic/conditions/field-types/multi-enum` | 1 | DynamicLogic |
| `views/admin/job/modals/detail` | 1 | Job |
| `views/admin/job/record/detail-small` | 1 | Job |
| `views/admin/job/record/list` | 1 | Job |
| `views/api-user/list` | 1 | ApiUser |
| `views/attachment/modals/detail` | 1 | Attachment |
| `views/attachment/record/detail` | 1 | Attachment |
| `views/attachment/record/list` | 1 | Attachment |
| `views/authentication-provider/record/detail` | 1 | AuthenticationProvider |
| `views/authentication-provider/record/edit` | 1 | AuthenticationProvider |
| `views/currency-record/list` | 1 | CurrencyRecord |
| `views/currency-record/record/panels/rates` | 1 | CurrencyRecord |
| `views/dashboard-template/detail` | 1 | DashboardTemplate |
| `views/dashboard-template/record/list` | 1 | DashboardTemplate |
| `views/email-account/list` | 1 | EmailAccount |
| `views/email-account/record/detail` | 1 | EmailAccount |
| `views/email-account/record/edit` | 1 | EmailAccount |
| `views/email-account/record/list` | 1 | EmailAccount |
| `views/email-filter/modals/edit` | 1 | EmailFilter |
| `views/email-filter/record/list` | 1 | EmailFilter |
| `views/email-folder/list` | 1 | EmailFolder |
| `views/email-folder/record/list` | 1 | EmailFolder |
| `views/email-template/list` | 1 | EmailTemplate |
| `views/email-template/record/detail` | 1 | EmailTemplate |
| `views/email-template/record/edit` | 1 | EmailTemplate |
| `views/email-template/record/edit-quick` | 1 | EmailTemplate |
| `views/email-template/record/panels/information` | 1 | EmailTemplate |
| `views/email/detail` | 1 | Email |
| `views/email/list` | 1 | Email |
| `views/email/modals/detail` | 1 | Email |
| `views/email/record/compose` | 1 | Email |
| `views/email/record/detail` | 1 | Email |
| `views/email/record/detail-quick` | 1 | Email |
| `views/email/record/edit` | 1 | Email |
| `views/email/record/edit-quick` | 1 | Email |
| `views/email/record/list` | 1 | Email |
| `views/email/record/list-related` | 1 | Email |
| `views/email/record/panels/default-side` | 1 | Email |
| `views/email/record/panels/event` | 1 | Email |
| `views/group-email-folder/list` | 1 | GroupEmailFolder |
| `views/group-email-folder/record/list` | 1 | GroupEmailFolder |
| `views/import/detail` | 1 | Import |
| `views/import/list` | 1 | Import |
| `views/import/record/detail` | 1 | Import |
| `views/import/record/list` | 1 | Import |
| `views/import/record/panels/duplicates` | 1 | Import |
| `views/import/record/panels/imported` | 1 | Import |
| `views/import/record/panels/updated` | 1 | Import |
| `views/import/record/row-actions/duplicates` | 1 | Import |
| `views/inbound-email/record/detail` | 1 | InboundEmail |
| `views/inbound-email/record/edit` | 1 | InboundEmail |
| `views/inbound-email/record/list` | 1 | InboundEmail |
| `views/last-viewed/list` | 1 | LastViewed |
| `views/last-viewed/record/list` | 1 | LastViewed |
| `views/layout-set/record/list` | 1 | LayoutSet |
| `views/lead-capture-log-record/modals/detail` | 1 | LeadCaptureLogRecord |
| `views/lead-capture/record/detail` | 1 | LeadCapture |
| `views/lead-capture/record/list` | 1 | LeadCapture |
| `views/lead-capture/record/panels/form` | 1 | LeadCapture |
| `views/lead-capture/record/panels/request` | 1 | LeadCapture |
| `views/list-with-categories` | 1 | TargetList |
| `views/modals/compose-email` | 1 | Email |
| `views/note/modals/edit` | 1 | Note |
| `views/note/record/edit` | 1 | Note |
| `views/notification/items/email-inbox` | 1 | Notification |
| `views/notification/items/system` | 1 | Notification |
| `views/o-auth-account/records/panels/connection` | 1 | OAuthAccount |
| `views/pipeline/detail` | 1 | Pipeline |
| `views/pipeline/record/panels/stages` | 1 | Pipeline |
| `views/portal-role/list` | 1 | PortalRole |
| `views/portal-role/record/detail` | 1 | PortalRole |
| `views/portal-role/record/edit` | 1 | PortalRole |
| `views/portal-role/record/list` | 1 | PortalRole |
| `views/portal-user/list` | 1 | PortalUser |
| `views/portal/record/list` | 1 | Portal |
| `views/preferences/edit` | 1 | Preferences |
| `views/preferences/record/edit` | 1 | Preferences |
| `views/record/row-actions/relationship-no-unlink` | 1 | Campaign |
| `views/record/row-actions/relationship-view-and-unlink` | 1 | KnowledgeBaseArticle |
| `views/record/row-actions/view-and-remove` | 1 | LeadCapture |
| `views/role/list` | 1 | Role |
| `views/role/record/detail` | 1 | Role |
| `views/role/record/edit` | 1 | Role |
| `views/role/record/list` | 1 | Role |
| `views/scheduled-job/list` | 1 | ScheduledJob |
| `views/scheduled-job/record/detail` | 1 | ScheduledJob |
| `views/scheduled-job/record/list` | 1 | ScheduledJob |
| `views/scheduled-job/record/panels/log` | 1 | ScheduledJob |
| `views/stream/notes/post` | 1 | Note |
| `views/stream/record/list` | 1 | Note |
| `views/team/modals/detail` | 1 | Team |
| `views/team/record/detail` | 1 | Team |
| `views/team/record/edit` | 1 | Team |
| `views/team/record/list` | 1 | Team |
| `views/template/record/detail` | 1 | Template |
| `views/template/record/edit` | 1 | Template |
| `views/user/list` | 1 | User |
| `views/user/modals/detail` | 1 | User |
| `views/user/modals/mass-update` | 1 | User |
| `views/user/modals/select-followers` | 1 | User |
| `views/user/record/panels/default-side` | 1 | User |
| `views/webhook/record/list` | 1 | Webhook |

## Theo scope

### Account

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record` |
| Crm | `aclPortal` | `crm:acl-portal/account` |
| Crm | `views.detail` | `crm:views/account/detail` |
| Crm | `relationshipPanels.campaignLogRecords.rowActionsView` | `views/record/row-actions/empty` |
| Crm | `relationshipPanels.targetLists.rowActionsView` | `crm:views/record/row-actions/relationship-target` |
| Crm | `relationshipPanels.targetLists.view` | `crm:views/record/panels/target-lists` |

### ActionHistoryRecord

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `recordViews.list` | `views/action-history-record/record/list` |
| core | `modalViews.detail` | `views/action-history-record/modals/detail` |

### Activities

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `crm:controllers/activities` |

### AddressCountry

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `menu.list.dropdown[0].handler` | `handlers/admin/address-country/populate-defaults` |

### AddressMap

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/address-map` |

### ApiUser

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/api-user` |
| core | `views.detail` | `views/user/detail` |
| core | `views.list` | `views/api-user/list` |
| core | `recordViews.list` | `views/user/record/list` |
| core | `recordViews.detail` | `views/user/record/detail` |
| core | `recordViews.edit` | `views/user/record/edit` |
| core | `recordViews.detailSmall` | `views/user/record/detail-quick` |
| core | `recordViews.editSmall` | `views/user/record/edit-quick` |
| core | `menu.list.dropdown[0].handler` | `handlers/api-user/open-api-spec-action` |

### AppLogRecord

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `recordViews.list` | `views/admin/app-log-record/record/list` |

### AppSecret

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |

### Attachment

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `recordViews.list` | `views/attachment/record/list` |
| core | `recordViews.detail` | `views/attachment/record/detail` |
| core | `modalViews.detail` | `views/attachment/modals/detail` |

### AuthLogRecord

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `recordViews.list` | `views/admin/auth-log-record/record/list` |
| core | `recordViews.detail` | `views/admin/auth-log-record/record/detail` |
| core | `recordViews.detailSmall` | `views/admin/auth-log-record/record/detail-small` |
| core | `modalViews.detail` | `views/admin/auth-log-record/modals/detail` |
| core | `relationshipPanels.actionHistoryRecords.rowActionsView` | `views/record/row-actions/relationship-view-only` |

### AuthToken

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `recordViews.list` | `views/admin/auth-token/record/list` |
| core | `recordViews.detail` | `views/admin/auth-token/record/detail` |
| core | `recordViews.detailSmall` | `views/admin/auth-token/record/detail-small` |
| core | `modalViews.detail` | `views/admin/auth-token/modals/detail` |
| core | `relationshipPanels.actionHistoryRecords.rowActionsView` | `views/record/row-actions/relationship-view-only` |

### AuthenticationProvider

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `recordViews.detail` | `views/authentication-provider/record/detail` |
| core | `recordViews.edit` | `views/authentication-provider/record/edit` |

### Call

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record` |
| Crm | `acl` | `crm:acl/call` |
| Crm | `views.detail` | `crm:views/call/detail` |
| Crm | `recordViews.list` | `crm:views/call/record/list` |
| Crm | `recordViews.detail` | `crm:views/call/record/detail` |
| Crm | `recordViews.editSmall` | `crm:views/call/record/edit-small` |
| Crm | `modalViews.detail` | `crm:views/meeting/modals/detail` |
| Crm | `viewSetupHandlers.record/detail[1]` | `crm:handlers/event/reminders-handler` |
| Crm | `viewSetupHandlers.record/edit[1]` | `crm:handlers/event/reminders-handler` |
| Crm | `sidePanels.detail[0].view` | `crm:views/meeting/record/panels/attendees` |
| Crm | `sidePanels.detailSmall[0].view` | `crm:views/meeting/record/panels/attendees` |
| Crm | `sidePanels.edit[0].view` | `crm:views/meeting/record/panels/attendees` |
| Crm | `sidePanels.editSmall[0].view` | `crm:views/meeting/record/panels/attendees` |
| Crm | `bottomPanels.detail[0].view` | `crm:views/meeting/record/panels/scheduler` |
| Crm | `bottomPanels.edit[0].view` | `crm:views/meeting/record/panels/scheduler` |
| Crm | `bottomPanels.editSmall[0].view` | `crm:views/meeting/record/panels/scheduler` |
| Crm | `relationshipPanels.contacts.selectHandler` | `handlers/select-related/same-account-many` |

### Campaign

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record` |
| Crm | `recordViews.detail` | `crm:views/campaign/record/detail` |
| Crm | `views.detail` | `crm:views/campaign/detail` |
| Crm | `sidePanels.detail[0].view` | `crm:views/campaign/record/panels/campaign-stats` |
| Crm | `relationshipPanels.campaignLogRecords.view` | `crm:views/campaign/record/panels/campaign-log-records` |
| Crm | `relationshipPanels.campaignLogRecords.rowActionsView` | `views/record/row-actions/remove-only` |
| Crm | `relationshipPanels.massEmails.createHandler` | `crm:handlers/campaign/mass-emails-create` |
| Crm | `relationshipPanels.massEmails.recordListView` | `crm:views/mass-email/record/list-for-campaign` |
| Crm | `relationshipPanels.massEmails.rowActionsView` | `crm:views/mass-email/record/row-actions/for-campaign` |
| Crm | `relationshipPanels.trackingUrls.rowActionsView` | `views/record/row-actions/relationship-no-unlink` |

### CampaignLogRecord

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `acl` | `crm:acl/campaign-tracking-url` |

### CampaignTrackingUrl

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record` |
| Crm | `acl` | `crm:acl/campaign-tracking-url` |
| Crm | `recordViews.edit` | `crm:views/campaign-tracking-url/record/edit` |
| Crm | `recordViews.editQuick` | `crm:views/campaign-tracking-url/record/edit-small` |

### Case

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record` |
| Crm | `recordViews.detail` | `crm:views/case/record/detail` |
| Crm | `detailActionList[0].handler` | `crm:handlers/case/detail-actions` |
| Crm | `detailActionList[1].handler` | `crm:handlers/case/detail-actions` |
| Crm | `sidePanels.detail[0].view` | `crm:views/case/record/panels/activities` |
| Crm | `sidePanels.detailSmall[0].view` | `crm:views/case/record/panels/activities` |
| Crm | `bottomPanels.detail[0].view` | `crm:views/case/record/panels/activities` |
| Crm | `relationshipPanels.contacts.selectHandler` | `handlers/select-related/same-account-many` |
| Crm | `relationshipPanels.contact.selectHandler` | `handlers/select-related/same-account-many` |

### Contact

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record` |
| Crm | `aclPortal` | `crm:acl-portal/contact` |
| Crm | `views.detail` | `crm:views/contact/detail` |
| Crm | `recordViews.detail` | `crm:views/contact/record/detail` |
| Crm | `recordViews.detailQuick` | `crm:views/contact/record/detail-small` |
| Crm | `relationshipPanels.campaignLogRecords.rowActionsView` | `views/record/row-actions/empty` |
| Crm | `relationshipPanels.opportunities.selectHandler` | `handlers/select-related/same-account` |
| Crm | `relationshipPanels.cases.selectHandler` | `handlers/select-related/same-account` |
| Crm | `relationshipPanels.targetLists.rowActionsView` | `crm:views/record/row-actions/relationship-target` |
| Crm | `relationshipPanels.targetLists.view` | `crm:views/record/panels/target-lists` |
| Crm | `relationshipPanels.meetings.createHandler` | `handlers/create-related/set-parent` |
| Crm | `relationshipPanels.calls.createHandler` | `handlers/create-related/set-parent` |

### CurrencyRecord

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `views.list` | `views/currency-record/list` |
| core | `viewSetupHandlers.record/detail[0]` | `handlers/currency-record/record-detail` |
| core | `relationshipPanels.rates.view` | `views/currency-record/record/panels/rates` |
| core | `menu.list.buttons[0].handler` | `handlers/currency-record/menu-action-settings` |

### CurrencyRecordRate

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `modelDefaultsPreparator` | `handlers/currency-record-rate/default-preparator` |
| core | `acl` | `acl/currency-record-rate` |

### Dashboard

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/dashboard` |

### DashboardTemplate

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `views.detail` | `views/dashboard-template/detail` |
| core | `recordViews.list` | `views/dashboard-template/record/list` |

### Document

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `aclPortal` | `crm:acl-portal/document` |
| Crm | `controller` | `controllers/record` |
| Crm | `views.list` | `crm:views/document/list` |
| Crm | `modalViews.select` | `crm:views/document/modals/select-records` |

### DocumentFolder

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record-tree` |

### DynamicLogic

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `itemTypes.and.view` | `views/admin/dynamic-logic/conditions-string/group-base` |
| core | `itemTypes.or.view` | `views/admin/dynamic-logic/conditions-string/group-base` |
| core | `itemTypes.not.view` | `views/admin/dynamic-logic/conditions-string/group-not` |
| core | `itemTypes.equals.view` | `views/admin/dynamic-logic/conditions-string/item-base` |
| core | `itemTypes.notEquals.view` | `views/admin/dynamic-logic/conditions-string/item-base` |
| core | `itemTypes.greaterThan.view` | `views/admin/dynamic-logic/conditions-string/item-base` |
| core | `itemTypes.lessThan.view` | `views/admin/dynamic-logic/conditions-string/item-base` |
| core | `itemTypes.greaterThanOrEquals.view` | `views/admin/dynamic-logic/conditions-string/item-base` |
| core | `itemTypes.lessThanOrEquals.view` | `views/admin/dynamic-logic/conditions-string/item-base` |
| core | `itemTypes.isEmpty.view` | `views/admin/dynamic-logic/conditions-string/item-operator-only-base` |
| core | `itemTypes.isNotEmpty.view` | `views/admin/dynamic-logic/conditions-string/item-operator-only-base` |
| core | `itemTypes.isTrue.view` | `views/admin/dynamic-logic/conditions-string/item-operator-only-base` |
| core | `itemTypes.isFalse.view` | `views/admin/dynamic-logic/conditions-string/item-operator-only-base` |
| core | `itemTypes.in.view` | `views/admin/dynamic-logic/conditions-string/item-multiple-values-base` |
| core | `itemTypes.notIn.view` | `views/admin/dynamic-logic/conditions-string/item-multiple-values-base` |
| core | `itemTypes.isToday.view` | `views/admin/dynamic-logic/conditions-string/item-is-today` |
| core | `itemTypes.inFuture.view` | `views/admin/dynamic-logic/conditions-string/item-in-future` |
| core | `itemTypes.inPast.view` | `views/admin/dynamic-logic/conditions-string/item-in-past` |
| core | `itemTypes.contains.view` | `views/admin/dynamic-logic/conditions-string/item-value-link` |
| core | `itemTypes.notContains.view` | `views/admin/dynamic-logic/conditions-string/item-value-link` |
| core | `itemTypes.has.view` | `views/admin/dynamic-logic/conditions-string/item-value-enum` |
| core | `itemTypes.notHas.view` | `views/admin/dynamic-logic/conditions-string/item-value-enum` |
| core | `itemTypes.startsWith.view` | `views/admin/dynamic-logic/conditions-string/item-value-varchar` |
| core | `itemTypes.endsWith.view` | `views/admin/dynamic-logic/conditions-string/item-value-varchar` |
| core | `itemTypes.matches.view` | `views/admin/dynamic-logic/conditions-string/item-value-varchar` |
| core | `fieldTypes.bool.view` | `views/admin/dynamic-logic/conditions/field-types/base` |
| core | `fieldTypes.varchar.view` | `views/admin/dynamic-logic/conditions/field-types/base` |
| core | `fieldTypes.varchar.conditionTypes.contains.itemView` | `views/admin/dynamic-logic/conditions-string/item-base` |
| core | `fieldTypes.varchar.conditionTypes.notContains.itemView` | `views/admin/dynamic-logic/conditions-string/item-base` |
| core | `fieldTypes.url.view` | `views/admin/dynamic-logic/conditions/field-types/base` |
| core | `fieldTypes.email.view` | `views/admin/dynamic-logic/conditions/field-types/base` |
| core | `fieldTypes.phone.view` | `views/admin/dynamic-logic/conditions/field-types/base` |
| core | `fieldTypes.text.view` | `views/admin/dynamic-logic/conditions/field-types/base` |
| core | `fieldTypes.text.conditionTypes.contains.itemView` | `views/admin/dynamic-logic/conditions-string/item-value-varchar` |
| core | `fieldTypes.text.conditionTypes.notContains.itemView` | `views/admin/dynamic-logic/conditions-string/item-value-varchar` |
| core | `fieldTypes.wysiwyg.view` | `views/admin/dynamic-logic/conditions/field-types/base` |
| core | `fieldTypes.wysiwyg.conditionTypes.contains.itemView` | `views/admin/dynamic-logic/conditions-string/item-value-varchar` |
| core | `fieldTypes.wysiwyg.conditionTypes.notContains.itemView` | `views/admin/dynamic-logic/conditions-string/item-value-varchar` |
| core | `fieldTypes.int.view` | `views/admin/dynamic-logic/conditions/field-types/base` |
| core | `fieldTypes.float.view` | `views/admin/dynamic-logic/conditions/field-types/base` |
| core | `fieldTypes.decimal.view` | `views/admin/dynamic-logic/conditions/field-types/base` |
| core | `fieldTypes.currency.view` | `views/admin/dynamic-logic/conditions/field-types/base` |
| core | `fieldTypes.date.view` | `views/admin/dynamic-logic/conditions/field-types/date` |
| core | `fieldTypes.datetime.view` | `views/admin/dynamic-logic/conditions/field-types/date` |
| core | `fieldTypes.datetimeOptional.view` | `views/admin/dynamic-logic/conditions/field-types/date` |
| core | `fieldTypes.enum.view` | `views/admin/dynamic-logic/conditions/field-types/enum` |
| core | `fieldTypes.link.view` | `views/admin/dynamic-logic/conditions/field-types/link` |
| core | `fieldTypes.linkOne.view` | `views/admin/dynamic-logic/conditions/field-types/link` |
| core | `fieldTypes.file.view` | `views/admin/dynamic-logic/conditions/field-types/link` |
| core | `fieldTypes.image.view` | `views/admin/dynamic-logic/conditions/field-types/link` |
| core | `fieldTypes.linkParent.view` | `views/admin/dynamic-logic/conditions/field-types/link-parent` |
| core | `fieldTypes.linkMultiple.view` | `views/admin/dynamic-logic/conditions/field-types/link-multiple` |
| core | `fieldTypes.foreign.view` | `views/admin/dynamic-logic/conditions/field-types/base` |
| core | `fieldTypes.id.view` | `views/admin/dynamic-logic/conditions/field-types/enum` |
| core | `fieldTypes.multiEnum.view` | `views/admin/dynamic-logic/conditions/field-types/multi-enum` |
| core | `fieldTypes.array.view` | `views/admin/dynamic-logic/conditions/field-types/multi-enum` |
| core | `fieldTypes.checklist.view` | `views/admin/dynamic-logic/conditions/field-types/multi-enum` |
| core | `fieldTypes.urlMultiple.view` | `views/admin/dynamic-logic/conditions/field-types/multi-enum` |
| core | `fieldTypes.currentUser.view` | `views/admin/dynamic-logic/conditions/field-types/current-user` |
| core | `fieldTypes.currentUserTeams.view` | `views/admin/dynamic-logic/conditions/field-types/current-user-teams` |

### Email

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/email` |
| core | `acl` | `acl/email` |
| core | `views.list` | `views/email/list` |
| core | `views.detail` | `views/email/detail` |
| core | `recordViews.list` | `views/email/record/list` |
| core | `recordViews.detail` | `views/email/record/detail` |
| core | `recordViews.edit` | `views/email/record/edit` |
| core | `recordViews.editQuick` | `views/email/record/edit-quick` |
| core | `recordViews.detailQuick` | `views/email/record/detail-quick` |
| core | `recordViews.compose` | `views/email/record/compose` |
| core | `recordViews.listRelated` | `views/email/record/list-related` |
| core | `modalViews.detail` | `views/email/modals/detail` |
| core | `modalViews.compose` | `views/modals/compose-email` |
| core | `defaultSidePanelView` | `views/email/record/panels/default-side` |
| core | `sidePanels.detail[0].view` | `views/email/record/panels/event` |
| core | `menu.list.dropdown[1].handler` | `handlers/email/list-actions` |
| core | `relationshipPanels.users.selectHandler` | `handlers/email/select-user` |

### EmailAccount

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `recordViews.list` | `views/email-account/record/list` |
| core | `recordViews.detail` | `views/email-account/record/detail` |
| core | `recordViews.edit` | `views/email-account/record/edit` |
| core | `views.list` | `views/email-account/list` |
| core | `detailActionList[0].handler` | `handlers/email-account/reset-fetch-data-action` |
| core | `relationshipPanels.filters.rowActionsView` | `views/record/row-actions/relationship-edit-and-remove` |
| core | `relationshipPanels.emails.rowActionsView` | `views/record/row-actions/remove-only` |

### EmailAddress

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |

### EmailFilter

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/email-filter` |
| core | `dynamicHandler` | `handlers/email-filter` |
| core | `modalViews.edit` | `views/email-filter/modals/edit` |
| core | `recordViews.list` | `views/email-filter/record/list` |

### EmailFolder

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `views.list` | `views/email-folder/list` |
| core | `recordViews.list` | `views/email-folder/record/list` |
| core | `recordViews.editQuick` | `views/email-folder/record/edit-small` |

### EmailQueueItem

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record` |
| Crm | `views.list` | `crm:views/email-queue-item/list` |
| Crm | `recordViews.list` | `crm:views/email-queue-item/record/list` |

### EmailTemplate

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `views.list` | `views/email-template/list` |
| core | `recordViews.edit` | `views/email-template/record/edit` |
| core | `recordViews.detail` | `views/email-template/record/detail` |
| core | `recordViews.editQuick` | `views/email-template/record/edit-quick` |
| core | `modalViews.select` | `views/modals/select-records-with-categories` |
| core | `sidePanels.detail[0].view` | `views/email-template/record/panels/information` |
| core | `sidePanels.edit[0].view` | `views/email-template/record/panels/information` |

### EmailTemplateCategory

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record-tree` |

### ExternalAccount

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/external-account` |

### Global

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `detailActionList[0].handler` | `handlers/record/view-audit-log` |
| core | `detailActionList[1].handler` | `handlers/record/view-user-access` |
| core | `detailActionList[2].handler` | `handlers/record/lock-action` |
| core | `detailActionList[3].handler` | `handlers/record/lock-action` |
| core | `massActionDefs.lock.handler` | `handlers/record/lock-mass-action` |
| core | `massActionDefs.unlock.handler` | `handlers/record/lock-mass-action` |
| core | `viewSetupHandlers.record/detail[0]` | `handlers/record/lock-view-setup` |
| core | `viewSetupHandlers.record/detail[1]` | `handlers/record/pipeline-view-setup` |
| core | `viewSetupHandlers.record/edit[0]` | `handlers/record/lock-view-setup` |
| core | `viewSetupHandlers.record/edit[1]` | `handlers/record/pipeline-view-setup` |

### GlobalStream

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/global-stream` |

### GroupEmailFolder

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `views.list` | `views/group-email-folder/list` |
| core | `recordViews.list` | `views/group-email-folder/record/list` |
| core | `recordViews.editQuick` | `views/email-folder/record/edit-small` |
| core | `relationshipPanels.emails.rowActionsView` | `views/record/row-actions/remove-only` |

### Import

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/import` |
| core | `acl` | `acl/import` |
| core | `recordViews.list` | `views/import/record/list` |
| core | `recordViews.detail` | `views/import/record/detail` |
| core | `views.list` | `views/import/list` |
| core | `views.detail` | `views/import/detail` |
| core | `bottomPanels.detail[0].view` | `views/import/record/panels/imported` |
| core | `bottomPanels.detail[1].view` | `views/import/record/panels/duplicates` |
| core | `bottomPanels.detail[1].rowActionsView` | `views/import/record/row-actions/duplicates` |
| core | `bottomPanels.detail[2].view` | `views/import/record/panels/updated` |
| core | `relationshipPanels.errors.actionList[0].handler` | `handlers/import` |

### ImportError

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `acl` | `acl/foreign` |

### InboundEmail

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `recordViews.detail` | `views/inbound-email/record/detail` |
| core | `recordViews.edit` | `views/inbound-email/record/edit` |
| core | `recordViews.list` | `views/inbound-email/record/list` |
| core | `detailActionList[0].handler` | `handlers/email-account/reset-fetch-data-action` |
| core | `relationshipPanels.filters.rowActionsView` | `views/record/row-actions/relationship-edit-and-remove` |
| core | `relationshipPanels.emails.rowActionsView` | `views/record/row-actions/remove-only` |

### Job

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `modalViews.detail` | `views/admin/job/modals/detail` |
| core | `recordViews.list` | `views/admin/job/record/list` |
| core | `recordViews.detailQuick` | `views/admin/job/record/detail-small` |

### KnowledgeBaseArticle

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record` |
| Crm | `views.list` | `crm:views/knowledge-base-article/list` |
| Crm | `recordViews.editQuick` | `crm:views/knowledge-base-article/record/edit-quick` |
| Crm | `recordViews.detailQuick` | `crm:views/knowledge-base-article/record/detail-quick` |
| Crm | `recordViews.detail` | `crm:views/knowledge-base-article/record/detail` |
| Crm | `recordViews.edit` | `crm:views/knowledge-base-article/record/edit` |
| Crm | `recordViews.list` | `crm:views/knowledge-base-article/record/list` |
| Crm | `modalViews.select` | `crm:views/knowledge-base-article/modals/select-records` |
| Crm | `rowActionDefs.moveToTop.handler` | `crm:handlers/knowledge-base-article/move` |
| Crm | `rowActionDefs.moveUp.handler` | `crm:handlers/knowledge-base-article/move` |
| Crm | `rowActionDefs.moveDown.handler` | `crm:handlers/knowledge-base-article/move` |
| Crm | `rowActionDefs.moveToBottom.handler` | `crm:handlers/knowledge-base-article/move` |
| Crm | `rowActionDefs.sendInEmail.handler` | `crm:handlers/knowledge-base-article/send-in-email` |
| Crm | `relationshipPanels.cases.rowActionsView` | `views/record/row-actions/relationship-view-and-unlink` |

### KnowledgeBaseCategory

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record-tree` |

### LastViewed

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/last-viewed` |
| core | `views.list` | `views/last-viewed/list` |
| core | `recordViews.list` | `views/last-viewed/record/list` |

### LayoutSet

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/layout-set` |
| core | `recordViews.list` | `views/layout-set/record/list` |
| core | `relationshipPanels.teams.rowActionsView` | `views/record/row-actions/relationship-unlink-only` |

### Lead

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `crm:controllers/lead` |
| Crm | `views.detail` | `crm:views/lead/detail` |
| Crm | `recordViews.detail` | `crm:views/lead/record/detail` |
| Crm | `sidePanels.detail[0].view` | `crm:views/lead/record/panels/converted-to` |
| Crm | `sidePanels.edit[0].view` | `crm:views/lead/record/panels/converted-to` |
| Crm | `sidePanels.detailSmall[0].view` | `crm:views/lead/record/panels/converted-to` |
| Crm | `sidePanels.editSmall[0].view` | `crm:views/lead/record/panels/converted-to` |
| Crm | `relationshipPanels.campaignLogRecords.rowActionsView` | `views/record/row-actions/empty` |
| Crm | `relationshipPanels.targetLists.rowActionsView` | `crm:views/record/row-actions/relationship-target` |
| Crm | `relationshipPanels.targetLists.view` | `crm:views/record/panels/target-lists` |
| Crm | `relationshipPanels.meetings.createHandler` | `handlers/create-related/set-parent` |
| Crm | `relationshipPanels.calls.createHandler` | `handlers/create-related/set-parent` |

### LeadCapture

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `recordViews.detail` | `views/lead-capture/record/detail` |
| core | `recordViews.list` | `views/lead-capture/record/list` |
| core | `viewSetupHandlers.record/detail[0]` | `handlers/lead-capture/record-detail-view-setup` |
| core | `viewSetupHandlers.record/edit[0]` | `handlers/lead-capture/record-detail-view-setup` |
| core | `sidePanels.detail[0].view` | `views/lead-capture/record/panels/request` |
| core | `sidePanels.detail[1].view` | `views/lead-capture/record/panels/form` |
| core | `relationshipPanels.logRecords.rowActionsView` | `views/record/row-actions/view-and-remove` |
| core | `relationshipPanels.pipeline.selectHandler` | `handlers/lead-capture/pipeline-select-handler` |

### LeadCaptureLogRecord

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `modalViews.detail` | `views/lead-capture-log-record/modals/detail` |

### MassEmail

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record` |
| Crm | `acl` | `crm:acl/mass-email` |
| Crm | `recordViews.detail` | `crm:views/mass-email/record/detail` |
| Crm | `recordViews.edit` | `crm:views/mass-email/record/edit` |
| Crm | `recordViews.editQuick` | `crm:views/mass-email/record/edit-small` |
| Crm | `views.detail` | `crm:views/mass-email/detail` |

### Meeting

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record` |
| Crm | `acl` | `crm:acl/meeting` |
| Crm | `views.detail` | `crm:views/meeting/detail` |
| Crm | `recordViews.list` | `crm:views/meeting/record/list` |
| Crm | `recordViews.detail` | `crm:views/meeting/record/detail` |
| Crm | `recordViews.editSmall` | `crm:views/meeting/record/edit-small` |
| Crm | `modalViews.detail` | `crm:views/meeting/modals/detail` |
| Crm | `viewSetupHandlers.record/detail[1]` | `crm:handlers/event/reminders-handler` |
| Crm | `viewSetupHandlers.record/edit[1]` | `crm:handlers/event/reminders-handler` |
| Crm | `sidePanels.detail[0].view` | `crm:views/meeting/record/panels/attendees` |
| Crm | `sidePanels.detailSmall[0].view` | `crm:views/meeting/record/panels/attendees` |
| Crm | `sidePanels.edit[0].view` | `crm:views/meeting/record/panels/attendees` |
| Crm | `sidePanels.editSmall[0].view` | `crm:views/meeting/record/panels/attendees` |
| Crm | `bottomPanels.detail[0].view` | `crm:views/meeting/record/panels/scheduler` |
| Crm | `bottomPanels.edit[0].view` | `crm:views/meeting/record/panels/scheduler` |
| Crm | `bottomPanels.editSmall[0].view` | `crm:views/meeting/record/panels/scheduler` |
| Crm | `relationshipPanels.contacts.selectHandler` | `handlers/select-related/same-account-many` |

### Note

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/note` |
| core | `recordViews.edit` | `views/note/record/edit` |
| core | `recordViews.editQuick` | `views/note/record/edit` |
| core | `recordViews.listRelated` | `views/stream/record/list` |
| core | `modalViews.edit` | `views/note/modals/edit` |
| core | `itemViews.Post` | `views/stream/notes/post` |
| core | `viewSetupHandlers.record/detail[0]` | `handlers/note/record-detail-setup` |
| Crm | `itemViews.EventConfirmation` | `crm:views/stream/notes/event-confirmation` |

### Notification

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/notification` |
| core | `acl` | `acl/notification` |
| core | `aclPortal` | `acl-portal/notification` |
| core | `itemViews.System` | `views/notification/items/system` |
| core | `itemViews.EmailInbox` | `views/notification/items/email-inbox` |
| Crm | `itemViews.EventAttendee` | `crm:views/notification/items/event-attendee` |

### OAuthAccount

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `sidePanels.detail[0].view` | `views/o-auth-account/records/panels/connection` |

### OAuthProvider

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |

### Opportunity

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record` |
| Crm | `modelDefaultsPreparator` | `crm:handlers/opportunity/defaults-preparator` |
| Crm | `views.detail` | `crm:views/opportunity/detail` |
| Crm | `recordViews.edit` | `crm:views/opportunity/record/edit` |
| Crm | `recordViews.editSmall` | `crm:views/opportunity/record/edit-small` |
| Crm | `recordViews.list` | `crm:views/opportunity/record/list` |
| Crm | `recordViews.kanban` | `crm:views/opportunity/record/kanban` |
| Crm | `sidePanels.detail[0].view` | `crm:views/opportunity/record/panels/activities` |
| Crm | `sidePanels.detailSmall[0].view` | `crm:views/opportunity/record/panels/activities` |
| Crm | `bottomPanels.detail[0].view` | `crm:views/opportunity/record/panels/activities` |
| Crm | `relationshipPanels.contacts.createHandler` | `crm:handlers/opportunity/contacts-create` |
| Crm | `relationshipPanels.contacts.selectHandler` | `handlers/select-related/same-account-many` |
| Crm | `relationshipPanels.contact.selectHandler` | `handlers/select-related/same-account-many` |
| Crm | `relationshipPanels.documents.selectHandler` | `handlers/select-related/same-account-many` |

### PasswordChangeRequest

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/password-change-request` |

### PhoneNumber

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |

### Pipeline

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `views.detail` | `views/pipeline/detail` |
| core | `rowActionDefs.moveUp.handler` | `handlers/pipeline/move-row-action` |
| core | `rowActionDefs.moveDown.handler` | `handlers/pipeline/move-row-action` |
| core | `relationshipPanels.stages.view` | `views/pipeline/record/panels/stages` |

### PipelineStage

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `rowActionDefs.moveUp.handler` | `handlers/pipeline-stage/move-row-action` |
| core | `rowActionDefs.moveDown.handler` | `handlers/pipeline-stage/move-row-action` |

### Portal

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `recordViews.list` | `views/portal/record/list` |
| core | `relationshipPanels.users.rowActionsView` | `views/record/row-actions/relationship-unlink-only` |

### PortalRole

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `recordViews.detail` | `views/portal-role/record/detail` |
| core | `recordViews.edit` | `views/portal-role/record/edit` |
| core | `recordViews.editQuick` | `views/portal-role/record/edit` |
| core | `recordViews.list` | `views/portal-role/record/list` |
| core | `relationshipPanels.users.rowActionsView` | `views/record/row-actions/relationship-unlink-only` |
| core | `views.list` | `views/portal-role/list` |

### PortalUser

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/portal-user` |
| core | `views.detail` | `views/user/detail` |
| core | `views.list` | `views/portal-user/list` |
| core | `recordViews.list` | `views/user/record/list` |
| core | `recordViews.detail` | `views/user/record/detail` |
| core | `recordViews.edit` | `views/user/record/edit` |
| core | `recordViews.detailSmall` | `views/user/record/detail-quick` |
| core | `recordViews.editSmall` | `views/user/record/edit-quick` |

### Preferences

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `recordViews.edit` | `views/preferences/record/edit` |
| core | `views.edit` | `views/preferences/edit` |
| core | `acl` | `acl/preferences` |
| core | `aclPortal` | `acl-portal/preferences` |

### Role

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `recordViews.detail` | `views/role/record/detail` |
| core | `recordViews.edit` | `views/role/record/edit` |
| core | `recordViews.editQuick` | `views/role/record/edit` |
| core | `recordViews.list` | `views/role/record/list` |
| core | `relationshipPanels.users.rowActionsView` | `views/record/row-actions/relationship-unlink-only` |
| core | `relationshipPanels.teams.rowActionsView` | `views/record/row-actions/relationship-unlink-only` |
| core | `views.list` | `views/role/list` |

### ScheduledJob

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `relationshipPanels.log.view` | `views/scheduled-job/record/panels/log` |
| core | `recordViews.list` | `views/scheduled-job/record/list` |
| core | `recordViews.detail` | `views/scheduled-job/record/detail` |
| core | `views.list` | `views/scheduled-job/list` |

### ScheduledJobLogRecord

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |

### Stream

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/stream` |

### TargetList

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record` |
| Crm | `sidePanels.detail[0].view` | `crm:views/target-list/record/panels/opted-out` |
| Crm | `views.list` | `views/list-with-categories` |
| Crm | `recordViews.detail` | `crm:views/target-list/record/detail` |
| Crm | `modalViews.select` | `views/modals/select-records-with-categories` |
| Crm | `relationshipPanels.contacts.rowActionsView` | `crm:views/target-list/record/row-actions/default` |
| Crm | `relationshipPanels.contacts.view` | `crm:views/target-list/record/panels/relationship` |
| Crm | `relationshipPanels.leads.rowActionsView` | `crm:views/target-list/record/row-actions/default` |
| Crm | `relationshipPanels.leads.view` | `crm:views/target-list/record/panels/relationship` |
| Crm | `relationshipPanels.accounts.rowActionsView` | `crm:views/target-list/record/row-actions/default` |
| Crm | `relationshipPanels.accounts.view` | `crm:views/target-list/record/panels/relationship` |
| Crm | `relationshipPanels.users.rowActionsView` | `crm:views/target-list/record/row-actions/default` |
| Crm | `relationshipPanels.users.view` | `crm:views/target-list/record/panels/relationship` |

### TargetListCategory

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `controllers/record-tree` |

### Task

| Nguồn | Khoá | Module JS |
|---|---|---|
| Crm | `controller` | `crm:controllers/task` |
| Crm | `recordViews.list` | `crm:views/task/record/list` |
| Crm | `recordViews.detail` | `crm:views/task/record/detail` |
| Crm | `views.list` | `crm:views/task/list` |
| Crm | `views.detail` | `crm:views/task/detail` |
| Crm | `viewSetupHandlers.record/detail[1]` | `crm:handlers/task/reminders-handler` |
| Crm | `viewSetupHandlers.record/edit[1]` | `crm:handlers/task/reminders-handler` |

### Team

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `acl` | `acl/team` |
| core | `recordViews.detail` | `views/team/record/detail` |
| core | `recordViews.edit` | `views/team/record/edit` |
| core | `recordViews.list` | `views/team/record/list` |
| core | `modalViews.detail` | `views/team/modals/detail` |

### Template

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `recordViews.detail` | `views/template/record/detail` |
| core | `recordViews.edit` | `views/template/record/edit` |

### User

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/user` |
| core | `acl` | `acl/user` |
| core | `views.detail` | `views/user/detail` |
| core | `views.list` | `views/user/list` |
| core | `recordViews.detail` | `views/user/record/detail` |
| core | `recordViews.detailSmall` | `views/user/record/detail-quick` |
| core | `recordViews.edit` | `views/user/record/edit` |
| core | `recordViews.editSmall` | `views/user/record/edit-quick` |
| core | `recordViews.list` | `views/user/record/list` |
| core | `modalViews.selectFollowers` | `views/user/modals/select-followers` |
| core | `modalViews.detail` | `views/user/modals/detail` |
| core | `modalViews.massUpdate` | `views/user/modals/mass-update` |
| core | `rowActionDefs.changeTeamPosition.handler` | `handlers/user/change-team-position-row-action` |
| core | `defaultSidePanel.detail.view` | `views/user/record/panels/default-side` |
| core | `defaultSidePanel.detailSmall.view` | `views/user/record/panels/default-side` |
| core | `defaultSidePanel.edit.view` | `views/user/record/panels/default-side` |
| core | `defaultSidePanel.editSmall.view` | `views/user/record/panels/default-side` |
| core | `sidePanels.detail[2].view` | `crm:views/user/record/panels/tasks` |
| core | `sidePanels.detailSmall[2].view` | `crm:views/user/record/panels/tasks` |
| core | `relationshipPanels.targetLists.rowActionsView` | `crm:views/record/row-actions/relationship-target` |
| core | `relationshipPanels.targetLists.view` | `crm:views/record/panels/target-lists` |
| core | `relationshipPanels.contact.selectHandler` | `handlers/user/select-contact` |

### Webhook

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `recordViews.list` | `views/webhook/record/list` |

### WebhookEventQueueItem

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |

### WebhookQueueItem

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |

### WorkingTimeCalendar

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |

### WorkingTimeRange

| Nguồn | Khoá | Module JS |
|---|---|---|
| core | `controller` | `controllers/record` |
| core | `viewSetupHandlers.record/edit[0]` | `handlers/working-time-range` |
