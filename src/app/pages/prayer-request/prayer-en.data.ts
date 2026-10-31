import { PrayerCopy } from '../../features/prayer-form';
export const copy: PrayerCopy = {
  "fields": {
    "name": {
      "label": "Your Name",
      "placeholder": "Enter your name"
    },
    "place": {
      "label": "Location",
      "placeholder": "Enter your city/country"
    },
    "prayer-type": {
      "label": "Type of Prayer Request",
      "placeholder": ""
    },
    "prayer-request": {
      "label": "Your Prayer Request",
      "placeholder": "Share your prayer request here..."
    },
    "email": {
      "label": "Email Address",
      "placeholder": "Enter your email"
    }
  },
  "options": [
    {
      "value": "",
      "label": "Select a category"
    },
    {
      "value": "healing",
      "label": "Healing"
    },
    {
      "value": "guidance",
      "label": "Guidance & Direction"
    },
    {
      "value": "thanksgiving",
      "label": "Thanksgiving"
    },
    {
      "value": "family",
      "label": "Family & Relationships"
    },
    {
      "value": "financial",
      "label": "Financial Breakthrough"
    },
    {
      "value": "spiritual",
      "label": "Spiritual Growth"
    },
    {
      "value": "other",
      "label": "Other"
    }
  ],
  "whatsappLabel": "Send via WhatsApp",
  "emailLabel": "Submit Prayer Request",
  "whatsappToast": "Opening WhatsApp to send your prayer request...",
  "successToast": "Prayer request submitted successfully! We will pray for you.",
  "errorToast": "There was an error submitting your prayer request. Please try again.",
  "whatsappTemplate": "*Prayer Request*%0A%0A*Name:* ${name}%0A*Location:* ${place}%0A*Prayer Type:* ${prayerType}%0A*Request:* ${request}",
  "accessKey": "a675c6e8-367a-4887-9465-63dd6ea15e51"
};
