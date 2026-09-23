class Auditlog(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    user_type = models.CharField(max_length=50, blank=True, null=True)
    action = models.CharField(max_length=255)
    module = models.CharField(max_length=255)
    entity_type = models.CharField(max_length=255)
    entity_id = models.CharField(max_length=255)
    old_values = models.JSONField(blank=True, null=True)
    new_values = models.JSONField(blank=True, null=True)
    ip_address = models.CharField(max_length=39, blank=True, null=True)
    created_at = models.DateTimeField()
    user = models.ForeignKey('CoreUser', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_auditlog'


class Childenrollment(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    application_date = models.DateField(blank=True, null=True)
    enrollment_date = models.DateField(blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50)
    withdrawal_reason = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    student = models.ForeignKey('CoreStudent', models.DO_NOTHING)
    application = models.ForeignKey('CoreRegistrationapplication', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_childenrollment'


class Childvaccinationrecord(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    vaccine_name = models.CharField(max_length=255)
    dose = models.CharField(max_length=50)
    vaccination_date = models.DateField()
    provider = models.CharField(max_length=255, blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    document = models.ForeignKey('CoreDocument', models.DO_NOTHING, blank=True, null=True)
    student = models.ForeignKey('CoreStudent', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_childvaccinationrecord'


class ClassroomStaff(models.Model):
    classroom = models.ForeignKey(CoreClassroom, models.DO_NOTHING)
    user = models.ForeignKey('CoreUser', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_classroom_staff'
        unique_together = (('classroom', 'user'),)


class Consentform(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    content = models.TextField()
    form_type = models.CharField(max_length=50)
    requires_signature = models.BooleanField()
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    created_by = models.ForeignKey('CoreUser', models.DO_NOTHING, blank=True, null=True)
    daycare = models.ForeignKey('CoreDaycare', models.DO_NOTHING)
    version = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'core_consentform'


class Consentformassignment(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    status = models.CharField(max_length=50)
    due_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    assigned_by = models.ForeignKey('CoreUser', models.DO_NOTHING, blank=True, null=True)
    consent_form = models.ForeignKey(CoreConsentform, models.DO_NOTHING)
    family = models.ForeignKey('CoreFamily', models.DO_NOTHING, blank=True, null=True)
    student = models.ForeignKey('CoreStudent', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_consentformassignment'
        unique_together = (('consent_form', 'student'),)


class Consentformsignature(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    signature_name = models.CharField(max_length=255)
    ip_address = models.CharField(max_length=39, blank=True, null=True)
    agreement_text = models.TextField()
    signed_at = models.DateTimeField()
    created_at = models.DateTimeField()
    assignment = models.OneToOneField(CoreConsentformassignment, models.DO_NOTHING)
    signed_by = models.ForeignKey('CoreUser', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_consentformsignature'


class Daycareemergencyinformation(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    contact_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=100)
    alternate_phone = models.CharField(max_length=100, blank=True, null=True)
    email = models.CharField(max_length=254, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    police_contact = models.CharField(max_length=100, blank=True, null=True)
    fire_service_contact = models.CharField(max_length=100, blank=True, null=True)
    hospital_contact = models.CharField(max_length=100, blank=True, null=True)
    additional_instructions = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.OneToOneField(CoreDaycare, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_daycareemergencyinformation'


class Daycareholiday(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    name = models.CharField(max_length=255)
    holiday_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey(CoreDaycare, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_daycareholiday'


class Daycarelicense(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    license_type = models.CharField(max_length=100, blank=True, null=True)
    issuing_authority = models.CharField(max_length=255, blank=True, null=True)
    issue_date = models.DateField(blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50)
    document_path = models.CharField(max_length=2048, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.OneToOneField(CoreDaycare, models.DO_NOTHING)
    license_number = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_daycarelicense'


class Daycaresettings(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    timezone = models.CharField(max_length=50)
    date_format = models.CharField(max_length=20)
    time_format = models.CharField(max_length=20)
    currency = models.CharField(max_length=10)
    default_language = models.CharField(max_length=10)
    week_start_day = models.CharField(max_length=15)
    default_operating_start = models.TimeField(blank=True, null=True)
    default_operating_end = models.TimeField(blank=True, null=True)
    allow_parent_notifications = models.BooleanField()
    allow_staff_notifications = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.OneToOneField(CoreDaycare, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_daycaresettings'


class Enrollmentform(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    version = models.IntegerField()
    is_required = models.BooleanField()
    is_active = models.BooleanField()
    fields_schema = models.JSONField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey(CoreDaycare, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_enrollmentform'


class Family(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    family_name = models.CharField(max_length=255)
    status = models.CharField(max_length=50)
    primary_contact = models.CharField(max_length=255, blank=True, null=True)
    primary_email = models.CharField(max_length=254, blank=True, null=True)
    primary_phone = models.CharField(max_length=100, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey(CoreDaycare, models.DO_NOTHING)
    secondary_phone = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_family'


class Familyauditlog(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    action = models.CharField(max_length=255)
    details = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    actor = models.ForeignKey('CoreUser', models.DO_NOTHING, blank=True, null=True)
    family = models.ForeignKey(CoreFamily, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_familyauditlog'


class Familychild(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    created_at = models.DateTimeField()
    family = models.ForeignKey(CoreFamily, models.DO_NOTHING)
    student = models.ForeignKey('CoreStudent', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_familychild'
        unique_together = (('family', 'student'),)


class Familyguardian(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    relationship = models.CharField(max_length=100)
    is_primary = models.BooleanField()
    created_at = models.DateTimeField()
    family = models.ForeignKey(CoreFamily, models.DO_NOTHING)
    guardian = models.ForeignKey('CoreGuardian', models.DO_NOTHING)
    status = models.CharField(max_length=50)

    class Meta:
        managed = False
        db_table = 'core_familyguardian'
        unique_together = (('family', 'guardian'),)


class Familymessage(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    subject = models.CharField(max_length=255)
    body = models.TextField()
    message_type = models.CharField(max_length=50)
    is_read = models.BooleanField()
    read_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey(CoreDaycare, models.DO_NOTHING)
    family = models.ForeignKey(CoreFamily, models.DO_NOTHING)
    parent_message = models.ForeignKey('self', models.DO_NOTHING, blank=True, null=True)
    recipient = models.ForeignKey('CoreUser', models.DO_NOTHING, blank=True, null=True)
    sender = models.ForeignKey('CoreUser', models.DO_NOTHING, related_name='corefamilymessage_sender_set')

    class Meta:
        managed = False
        db_table = 'core_familymessage'


class Guardian(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    preferred_name = models.CharField(max_length=255, blank=True, null=True)
    email = models.CharField(unique=True, max_length=254, blank=True, null=True)
    phone = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey(CoreDaycare, models.DO_NOTHING)
    user = models.OneToOneField('CoreUser', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_guardian'


class Guardiancommunicationpreference(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    email_alerts = models.BooleanField()
    sms_alerts = models.BooleanField()
    emergency_alerts_only = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    guardian = models.OneToOneField(CoreGuardian, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_guardiancommunicationpreference'


class Guardianinvitation(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    email = models.CharField(max_length=254)
    relationship = models.CharField(max_length=100)
    token = models.CharField(unique=True, max_length=255)
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey(CoreDaycare, models.DO_NOTHING)
    invited_by = models.ForeignKey('CoreUser', models.DO_NOTHING, blank=True, null=True)
    student = models.ForeignKey('CoreStudent', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_guardianinvitation'


class Guardianpasswordresettoken(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    token = models.CharField(unique=True, max_length=255)
    created_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    used = models.BooleanField()
    user = models.ForeignKey('CoreUser', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_guardianpasswordresettoken'


class Registrationapplication(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    application_number = models.CharField(unique=True, max_length=100)
    applicant_name = models.CharField(max_length=255)
    applicant_email = models.CharField(max_length=254)
    applicant_phone = models.CharField(max_length=50)
    status = models.CharField(max_length=50)
    submitted_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey(CoreDaycare, models.DO_NOTHING)
    access_token = models.CharField(max_length=32)
    application_data = models.JSONField()

    class Meta:
        managed = False
        db_table = 'core_registrationapplication'


class Staffattendance(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    date = models.DateField()
    status = models.CharField(max_length=50)
    check_in_time = models.TimeField(blank=True, null=True)
    check_out_time = models.TimeField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    employee = models.ForeignKey(CoreEmployee, models.DO_NOTHING)
    logged_by = models.ForeignKey('CoreUser', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_staffattendance'
        unique_together = (('employee', 'date'),)


class Subscriptionfeature(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    name = models.CharField(max_length=255)
    code = models.CharField(unique=True, max_length=255)
    description = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_subscriptionfeature'


class Subscriptioninvoice(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    invoice_number = models.CharField(unique=True, max_length=100)
    issue_date = models.DateField()
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=5)  # max_digits and decimal_places have been guessed, as this database handles decimal fields as float
    tax = models.DecimalField(max_digits=10, decimal_places=5)  # max_digits and decimal_places have been guessed, as this database handles decimal fields as float
    total = models.DecimalField(max_digits=10, decimal_places=5)  # max_digits and decimal_places have been guessed, as this database handles decimal fields as float
    status = models.CharField(max_length=50)
    payment_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey(CoreDaycare, models.DO_NOTHING)
    subscription = models.ForeignKey(CoreDaycaresubscription, models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_subscriptioninvoice'


class Subscriptionpayment(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    amount = models.DecimalField(max_digits=10, decimal_places=5)  # max_digits and decimal_places have been guessed, as this database handles decimal fields as float
    payment_date = models.DateField()
    currency = models.CharField(max_length=10)
    payment_method = models.CharField(max_length=100)
    payment_status = models.CharField(max_length=50)
    transaction_reference = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey(CoreDaycare, models.DO_NOTHING)
    invoice = models.ForeignKey(CoreSubscriptioninvoice, models.DO_NOTHING, blank=True, null=True)
    subscription = models.ForeignKey(CoreDaycaresubscription, models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_subscriptionpayment'


class SubscriptionplanFeatures(models.Model):
    subscriptionplan = models.ForeignKey(CoreSubscriptionplan, models.DO_NOTHING)
    subscriptionfeature = models.ForeignKey(CoreSubscriptionfeature, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_subscriptionplan_features'
        unique_together = (('subscriptionplan', 'subscriptionfeature'),)


class Supportticket(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    ticket_number = models.CharField(unique=True, max_length=50)
    subject = models.CharField(max_length=255)
    description = models.TextField()
    priority = models.CharField(max_length=50)
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    created_by = models.ForeignKey('CoreUser', models.DO_NOTHING)
    daycare = models.ForeignKey(CoreDaycare, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_supportticket'


class Supportticketmessage(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    message = models.TextField()
    created_at = models.DateTimeField()
    sender = models.ForeignKey('CoreUser', models.DO_NOTHING)
    ticket = models.ForeignKey(CoreSupportticket, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_supportticketmessage'


class Systemannouncement(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    title = models.CharField(max_length=255)
    content = models.TextField()
    status = models.CharField(max_length=50)
    publish_date = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    created_by = models.ForeignKey('CoreUser', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'core_systemannouncement'


class SystemannouncementTargetDaycares(models.Model):
    systemannouncement = models.ForeignKey(CoreSystemannouncement, models.DO_NOTHING)
    daycare = models.ForeignKey(CoreDaycare, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_systemannouncement_target_daycares'
        unique_together = (('systemannouncement', 'daycare'),)


class Timeoffrequest(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    start_date = models.DateField()
    end_date = models.DateField()
    leave_type = models.CharField(max_length=50)
    reason = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    approved_by = models.ForeignKey('CoreUser', models.DO_NOTHING, blank=True, null=True)
    employee = models.ForeignKey(CoreEmployee, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_timeoffrequest'


class UserGroups(models.Model):
    user = models.ForeignKey(CoreUser, models.DO_NOTHING)
    group = models.ForeignKey(AuthGroup, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_user_groups'
        unique_together = (('user', 'group'),)


class UserUserPermissions(models.Model):
    user = models.ForeignKey(CoreUser, models.DO_NOTHING)
    permission = models.ForeignKey(AuthPermission, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_user_user_permissions'
        unique_together = (('user', 'permission'),)


class Waitlistentry(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    child_first_name = models.CharField(max_length=100)
    child_last_name = models.CharField(max_length=100)
    child_dob = models.DateField(blank=True, null=True)
    applicant_name = models.CharField(max_length=200)
    applicant_email = models.CharField(max_length=254)
    applicant_phone = models.CharField(max_length=20, blank=True, null=True)
    requested_start_date = models.DateField(blank=True, null=True)
    preferred_program = models.CharField(max_length=100, blank=True, null=True)
    preferred_branch = models.CharField(max_length=100, blank=True, null=True)
    priority = models.IntegerField()
    waitlist_date = models.DateTimeField()
    status = models.CharField(max_length=50)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    application = models.OneToOneField(CoreRegistrationapplication, models.DO_NOTHING, blank=True, null=True)
    daycare = models.ForeignKey(CoreDaycare, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'core_waitlistentry'


class DjangoAdminLog(models.Model):
    object_id = models.TextField(blank=True, null=True)
    object_repr = models.CharField(max_length=200)
    action_flag = models.PositiveSmallIntegerField()
    change_message = models.TextField()
    content_type = models.ForeignKey('DjangoContentType', models.DO_NOTHING, blank=True, null=True)
    user = models.ForeignKey(CoreUser, models.DO_NOTHING)
    action_time = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'django_admin_log'


class DjangoContentType(models.Model):
    app_label = models.CharField(max_length=100)
    model = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = 'django_content_type'
        unique_together = (('app_label', 'model'),)


class DjangoMigrations(models.Model):
    app = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    applied = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'django_migrations'


class DjangoSession(models.Model):
    session_key = models.CharField(primary_key=True, max_length=40)
    session_data = models.TextField()
    expire_date = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'django_session'