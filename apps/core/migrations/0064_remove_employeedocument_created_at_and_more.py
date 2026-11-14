from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0063_staffattendance_phase4_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='staffnotification',
            name='notification_type',
            field=models.CharField(
                choices=[
                    ('leave_requested', 'Leave Requested'),
                    ('leave_approved', 'Leave Approved'),
                    ('leave_rejected', 'Leave Rejected'),
                    ('shift_affected', 'Shift Coverage Affected'),
                    ('staff_shortage', 'Staff Shortage Alert'),
                    ('child_not_arrived', 'Child Not Checked In'),
                    ('child_missing_checkout', 'Missing Child Checkout'),
                    ('attendance_correction', 'Attendance Correction'),
                    ('timesheet_submitted', 'Timesheet Submitted'),
                    ('timesheet_approved', 'Timesheet Approved'),
                    ('timesheet_rejected', 'Timesheet Rejected'),
                    ('missing_staff_clockout', 'Missing Staff Clock-Out'),
                    ('overtime_approval_required', 'Overtime Approval Required'),
                ],
                max_length=50
            ),
        ),
    ]
