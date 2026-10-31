import { PrayerCopy } from '../../features/prayer-form';
export const copy: PrayerCopy = {
  "fields": {
    "name": {
      "label": "మీ పేరు",
      "placeholder": "మీ పేరును నమోదు చేయండి"
    },
    "place": {
      "label": "స్థానం",
      "placeholder": "మీ నగరం/దేశం నమోదు చేయండి"
    },
    "prayer-type": {
      "label": "ప్రార్థన అభ్యర్థన రకం",
      "placeholder": ""
    },
    "prayer-request": {
      "label": "మీ ప్రార్థన అభ్యర్థన",
      "placeholder": "మీ ప్రార్థన అభ్యర్థనను ఇక్కడ పంచుకోండి..."
    },
    "email": {
      "label": "ఇమెయిల్ చిరునామా",
      "placeholder": "మీ ఇమెయిల్ను నమోదు చేయండి"
    }
  },
  "options": [
    {
      "value": "",
      "label": "వర్గాన్ని ఎంచుకోండి"
    },
    {
      "value": "healing",
      "label": "స్వస్థత"
    },
    {
      "value": "guidance",
      "label": "మార్గదర్శకత్వం & దిశ"
    },
    {
      "value": "thanksgiving",
      "label": "కృతజ్ఞతలు"
    },
    {
      "value": "family",
      "label": "కుటుంబం & సంబంధాలు"
    },
    {
      "value": "financial",
      "label": "ఆర్థిక విజయం"
    },
    {
      "value": "spiritual",
      "label": "ఆధ్యాత్మిక వృద్ధి"
    },
    {
      "value": "other",
      "label": "ఇతరములు"
    }
  ],
  "whatsappLabel": "వాట్సాప్ ద్వారా పంపండి",
  "emailLabel": "ప్రార్థన అభ్యర్థనను సమర్పించండి",
  "whatsappToast": "మీ ప్రార్థన అభ్యర్థనను వాట్సాప్ ద్వారా పంపుతోంది...",
  "successToast": "ప్రార్థన అభ్యర్థన విజయవంతంగా సమర్పించబడింది! మేము మీ కోసం ప్రార్థిస్తాము.",
  "errorToast": "మీ ప్రార్థన అభ్యర్థనను సమర్పించడంలో లోపం ఉంది. దయచేసి మళ్లీ ప్రయత్నించండి.",
  "whatsappTemplate": "*ప్రార్థన అభ్యర్థన*%0A%0A*పేరు:* ${name}%0A*స్థానం:* ${place}%0A*ప్రార్థన రకం:* ${prayerType}%0A*అభ్యర్థన:* ${request}",
  "accessKey": "a675c6e8-367a-4887-9465-63dd6ea15e51"
};
