import { Routes } from '@angular/router';
import { preparePage } from './core/page-context';

export const contentRoutes: Routes = [
  {
    path: "english/books",
    title: "Books - Holy Army Fellowship",
    loadComponent: () => import('./pages/books/books-en').then(module => module.BooksEnglishPage),
    resolve: { appearance: preparePage },
    data: {"description":"Our Books: spiritual resources from Holy Army Fellowship to enrich your faith journey.","kind":"books","language":"en","styles":["/src/css/style.css","/src/css/books.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"1b608c8a46","navigation":"65e21e5429","footer":"6845712028"}}
  },
  {
    path: "english/chosen",
    title: "Chosen by God - Holy Army Fellowship",
    loadComponent: () => import('./pages/chosen/chosen-en').then(module => module.ChosenEnglishPage),
    resolve: { appearance: preparePage },
    data: {"description":"A Life Led by Christ: His Testimony. Discover the journey of faith that led to the birth of Holy Army Fellowship.","kind":"chosen","language":"en","styles":["/src/css/style.css","/src/css/chosen.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"1b608c8a46","navigation":"65e21e5429","footer":"6845712028"}}
  },
  {
    path: "english/faith",
    title: "Statement of Faith - Holy Army Fellowship",
    loadComponent: () => import('./pages/faith/faith-en').then(module => module.FaithEnglishPage),
    resolve: { appearance: preparePage },
    data: {"description":"Statement of Faith: the core beliefs and values of Holy Army Fellowship.","kind":"faith","language":"en","styles":["/src/css/style.css","/src/css/faith.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"1b608c8a46","navigation":"65e21e5429","footer":"6845712028"}}
  },
  {
    path: "english/gallery",
    title: "Gallery - Holy Army Fellowship",
    loadComponent: () => import('./pages/gallery/gallery-en').then(module => module.GalleryEnglishPage),
    resolve: { appearance: preparePage },
    data: {"description":"Our Journey in Pictures: capturing precious moments of faith, fellowship, and divine blessings.","kind":"gallery","language":"en","styles":["/src/css/style.css","/src/css/gallery.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"1b608c8a46","navigation":"65e21e5429","footer":"db1067e0a1"}}
  },
  {
    path: "english/home",
    title: "Holy Army Fellowship - Welcome",
    loadComponent: () => import('./pages/home/home-en').then(module => module.HomeEnglishPage),
    resolve: { appearance: preparePage },
    data: {"description":"Welcome to Holy Army Fellowship. Join us in worship and fellowship as we grow together in faith and service.","kind":"home","language":"en","styles":["/src/css/style.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"08a06d5bea","navigation":"65e21e5429","footer":"b94ca8ebdc"}}
  },
  {
    path: "english/origin",
    title: "Origin of Work - Holy Army Fellowship",
    loadComponent: () => import('./pages/origin/origin-en').then(module => module.OriginEnglishPage),
    resolve: { appearance: preparePage },
    data: {"description":"Origin of Work: the journey of Holy Army Fellowship.","kind":"origin","language":"en","styles":["/src/css/style.css","/src/css/origin.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"1b608c8a46","navigation":"65e21e5429","footer":"6845712028"}}
  },
  {
    path: "english/prayer-request",
    title: "Prayer Request - Holy Army Fellowship",
    loadComponent: () => import('./pages/prayer-request/prayer-request-en').then(module => module.PrayerRequestEnglishPage),
    resolve: { appearance: preparePage },
    data: {"description":"Send a prayer request to Holy Army Fellowship. \"Ask and it will be given to you; seek and you will find; knock and the door will be opened to you.\"","kind":"prayer-request","language":"en","styles":["/src/css/style.css","/src/css/prayer-request.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"1b608c8a46","navigation":"65e21e5429","footer":"6845712028"}}
  },
  {
    path: "english/testimonies",
    title: "Testimonies - Holy Army Fellowship",
    loadComponent: () => import('./pages/testimonies/testimonies-en').then(module => module.TestimoniesEnglishPage),
    resolve: { appearance: preparePage },
    data: {"description":"Testimonies of faith, healing, and transformation shared at Holy Army Fellowship.","kind":"testimonies","language":"en","styles":["/src/css/style.css","/src/css/testimonies.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"1b608c8a46","navigation":"65e21e5429","footer":"6845712028"}}
  },
  {
    path: "english/videos",
    title: "Videos - Holy Army Fellowship",
    loadComponent: () => import('./pages/videos/videos-en').then(module => module.VideosEnglishPage),
    resolve: { appearance: preparePage },
    data: {"description":"Experience worship and teachings through the songs and messages of Holy Army Fellowship.","kind":"videos","language":"en","styles":["/src/css/style.css","/src/css/videos.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap","/src/css/videos-en-inline.css"],"layout":{"header":"1b608c8a46","navigation":"65e21e5429","footer":"a266e0d98e"}}
  },
  {
    path: "telugu/books",
    title: "పుస్తకాలు - పరిశుద్ధ సైనిక సహవాసం",
    loadComponent: () => import('./pages/books/books-te').then(module => module.BooksTeluguPage),
    resolve: { appearance: preparePage },
    data: {"description":"మా పుస్తకాలు. మీ విశ్వాస ప్రయాణాన్ని సమృద్ధిగా చేసే ఆధ్యాత్మిక వనరులు","kind":"books","language":"te","styles":["/src/css/style.css","/src/css/books.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"f9145c5fb8","navigation":"e95f5b28b1","footer":"b3135df9d3"}}
  },
  {
    path: "telugu/chosen",
    title: "పరిశుద్ధ సైనిక సహవాసం",
    loadComponent: () => import('./pages/chosen/chosen-te').then(module => module.ChosenTeluguPage),
    resolve: { appearance: preparePage },
    data: {"description":"క్రీస్తు నడిపించిన జీవితం. హోలీ ఆర్మీ ఫెలోషిప్ స్థాపనకు దారితీసిన విశ్వాస ప్రయాణాన్ని కనుగొనండి.","kind":"chosen","language":"te","styles":["/src/css/style.css","/src/css/chosen.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"f9145c5fb8","navigation":"e95f5b28b1","footer":"966354593d"}}
  },
  {
    path: "telugu/faith",
    title: "విశ్వాస ప్రకటన - పరిశుద్ధ సైనిక సహవాసం",
    loadComponent: () => import('./pages/faith/faith-te').then(module => module.FaithTeluguPage),
    resolve: { appearance: preparePage },
    data: {"description":"విశ్వాస ప్రకటన. మా ప్రధాన నమ్మకాలు మరియు విలువలు","kind":"faith","language":"te","styles":["/src/css/style.css","/src/css/faith.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"9768122167","navigation":"e95f5b28b1","footer":"2bdc3112d9"}}
  },
  {
    path: "telugu/gallery",
    title: "గ్యాలరీ - పరిశుద్ధ సైనిక సహవాసం",
    loadComponent: () => import('./pages/gallery/gallery-te').then(module => module.GalleryTeluguPage),
    resolve: { appearance: preparePage },
    data: {"description":"పరిశుద్ధ సైనిక సహవాసం: చిత్రాలలో మా ప్రయాణం","kind":"gallery","language":"te","styles":["/src/css/style.css","/src/css/gallery.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"f9145c5fb8","navigation":"e95f5b28b1","footer":"2bdc3112d9"}}
  },
  {
    path: "telugu/home",
    title: "పరిశుద్ధ సైనిక సహవాసం - స్వాగతం",
    loadComponent: () => import('./pages/home/home-te').then(module => module.HomeTeluguPage),
    resolve: { appearance: preparePage },
    data: {"description":"పరిశుద్ధ సైనిక సహవాసానికి స్వాగతం. విశ్వాసం మరియు సేవలో కలిసి పెరుగుతూ ఆరాధన మరియు సహవాసంలో మాతో చేరండి","kind":"home","language":"te","styles":["/src/css/style.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"711bd5b1eb","navigation":"e95f5b28b1","footer":"379f8e5049"}}
  },
  {
    path: "telugu/origin",
    title: "సహవాసం యొక్క మూలం - పరిశుద్ధ సైనిక సహవాసం",
    loadComponent: () => import('./pages/origin/origin-te').then(module => module.OriginTeluguPage),
    resolve: { appearance: preparePage },
    data: {"description":"సహవాసం యొక్క మూలం. పరిశుద్ధ సైనిక సహవాసం ప్రయాణం","kind":"origin","language":"te","styles":["/src/css/style.css","/src/css/origin.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"9768122167","navigation":"e95f5b28b1","footer":"2bdc3112d9"}}
  },
  {
    path: "telugu/prayer-request",
    title: "ప్రార్థన అభ్యర్థన - పరిశుద్ధ సైనిక సహవాసం",
    loadComponent: () => import('./pages/prayer-request/prayer-request-te').then(module => module.PrayerRequestTeluguPage),
    resolve: { appearance: preparePage },
    data: {"description":"ప్రార్థన అభ్యర్థన. \"అడగండి ఇవ్వబడును; వెదకండి దొరకును; తట్టండి తెరువబడును.\"","kind":"prayer-request","language":"te","styles":["/src/css/style.css","/src/css/prayer-request.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"f9145c5fb8","navigation":"e95f5b28b1","footer":"05d21767ce"}}
  },
  {
    path: "telugu/testimonies",
    title: "సాక్ష్యాలు - పరిశుద్ధ సైనిక సహవాసం",
    loadComponent: () => import('./pages/testimonies/testimonies-te').then(module => module.TestimoniesTeluguPage),
    resolve: { appearance: preparePage },
    data: {"description":"సాక్ష్యాలు. విశ్వాసం ద్వారా స్వస్థతను పొందిన సేవకుల సాక్ష్యాలు","kind":"testimonies","language":"te","styles":["/src/css/style.css","/src/css/testimonies.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"f9145c5fb8","navigation":"e95f5b28b1","footer":"9a367d5607"}}
  },
  {
    path: "telugu/videos",
    title: "వీడియోస్ - పరిశుద్ధ సైనిక సహవాసం",
    loadComponent: () => import('./pages/videos/videos-te').then(module => module.VideosTeluguPage),
    resolve: { appearance: preparePage },
    data: {"description":"మా వీడియోలు. పాటలు మరియు పవిత్ర సందేశాల ద్వారా ఆరాధనతో కూడిన అనుభూతిని పొందండి.","kind":"videos","language":"te","styles":["/src/css/style.css","/src/css/videos.css","https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css","https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"],"layout":{"header":"711bd5b1eb","navigation":"e95f5b28b1","footer":"a266e0d98e"}}
  }
];
