# ledge-stay

A platform to help users find, list, and manage rental stays easily and efficiently.

## Resend email setup

Use these variables locally and in Railway:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM=LedgeStay <noreply@yourdomain.com>
EMAIL_REPLY_TO=support@yourdomain.com
APP_BASE_URL=https://ledge-stay.up.railway.app
```

Notes:

- `EMAIL_FROM` must be a real sender address, not just a domain name.
- The sender domain must be verified in Resend before production sends will work.
- For quick local testing, you can use `LedgeStay <onboarding@resend.dev>` as the sender.

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/m24rock-ops/ledge-stay?utm_source=oss&utm_medium=github&utm_campaign=m24rock-ops%2Fledge-stay&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
