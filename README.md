# Agent 58 — Faculty Workload System

## Quick start

### Backend
```bash
cd backend
npm install --legacy-peer-deps
npx prisma db push
npm run start:dev
```
API: http://localhost:3000/api

### Frontend
```bash
cd frontend
npm install
npm run dev
```
App: http://localhost:5173/login

## Logins

Every account uses the same pattern:

- **Email:** `name@vignan.ac.in`
- **Password:** `Vignan@` followed by 8 random digits

Sign in at http://localhost:5173/login with the email and password below. Each account opens the matching dashboard.

### Admin

| Name | Role | Email | Password |
|---|---|---|---|
| Mr. Uttej Kumar Nannapaneni | HR | uttejkumarn@vignan.ac.in | Vignan@44655544 |
| Dr. Venkatrama Phani Kumar S | HOD | svphanikumar@vignan.ac.in | Vignan@79565614 |
| Dr. K.V. Krishna Kishore | DEAN | kvkrishnakishore@vignan.ac.in | Vignan@69135562 |
| Dr. S. Deva Kumar | PRINCIPAL | sdevakumar@vignan.ac.in | Vignan@97536569 |

### CSE faculty (REAL)

| Name | Email | Password |
|---|---|---|
| Dr. Gabbi Reddy Keerthi | gabbireddykeerthi@vignan.ac.in | Vignan@43142376 |
| Mr. Senthil D | dsenthil@vignan.ac.in | Vignan@39206076 |
| Mr. Syed Nafees Ahamed | syednafeesahamed@vignan.ac.in | Vignan@61505252 |
| Ms. Pushya Chaparala | chpushya@vignan.ac.in | Vignan@75997638 |
| Bhathula Ninnagari | bhathulaninnagari@vignan.ac.in | Vignan@60996958 |
| Mrs. V. Sai Spandana | saispandanaverella@vignan.ac.in | Vignan@91700717 |
| Dr. J. Veeranjaneyulu | jveeranjaneyulu@vignan.ac.in | Vignan@51854048 |

### Other-department faculty (DEMO academic data)

CSE academic data is **REAL**. Other departments use **DEMO** timetable/workload data until a real timetable is imported. Identities, photos, and profile details for those departments come from https://vignan.ac.in/newvignan/people.php

| Department | Name | Email | Password |
|---|---|---|---|
| IT | Dr. Bhaskaru Obulapu | bhaskaruobulapu@vignan.ac.in | Vignan@91622904 |
| IT | Dr. Hemanta Kumar Bhuyan | hemantakumarbhuyan@vignan.ac.in | Vignan@85828152 |
| IT | Dr. Kamepalli Sujatha | kamepallisujatha@vignan.ac.in | Vignan@87986385 |
| IT | Dr. Nerella Sameera | nerellasameera@vignan.ac.in | Vignan@79460514 |
| IT | Dr. Peram Subba Rao | peramsubbarao@vignan.ac.in | Vignan@25828074 |
| CA | Dr. Kurra Santhi Sri | kurrasanthisri@vignan.ac.in | Vignan@73652801 |
| CA | Dr. N. Veeranjaneyulu | nveeranjaneyulu@vignan.ac.in | Vignan@21782060 |
| CA | Dr. R S Padma Priya | rspadmapriya@vignan.ac.in | Vignan@74131364 |
| CA | Mr. Irfan Sayyad | irfansayyad@vignan.ac.in | Vignan@45219451 |
| CA | Ms. Kota Lakshmi Thanuja | kotalakshmithanuja@vignan.ac.in | Vignan@11441501 |
| ACSE | Dr. Nirupama Bhat Mundukur | nirupamabhatmundukur@vignan.ac.in | Vignan@40594193 |
| ACSE | Dr. Sreekantha Reddy | sreekanthareddy@vignan.ac.in | Vignan@94404895 |
| ACSE | Dr. Venkatesulu Dondeti | venkatesuludondeti@vignan.ac.in | Vignan@52497442 |
| ACSE | Mr. Srinivasarao Pallanti | srinivasaraopallanti@vignan.ac.in | Vignan@12862470 |
| ACSE | Ms. Kondapalli Krupa Sagari | kondapallikrupasagari@vignan.ac.in | Vignan@11957888 |
| ECE | Dr. B Seetha Ramanjaneyulu | bseetharamanjaneyulu@vignan.ac.in | Vignan@64838902 |
| ECE | Dr. M.S.S. Rukmini | mssrukmini@vignan.ac.in | Vignan@70557577 |
| ECE | Dr. Ravi Sekhar Yarrabothu | ravisekharyarrabothu@vignan.ac.in | Vignan@91655727 |
| ECE | Dr. Sarada Musala | saradamusala@vignan.ac.in | Vignan@92011235 |
| ECE | Dr. Shaik Jakeer Hussain | shaikjakeerhussain@vignan.ac.in | Vignan@23765248 |
| EEE | Dr. Anil Kumar D | anilkumard@vignan.ac.in | Vignan@10271495 |
| EEE | Dr. Attuluri Rakada Vijay Babu | attulurirakadavijaybabu@vignan.ac.in | Vignan@52384998 |
| EEE | Dr. Mercy Rosalina | mercyrosalina@vignan.ac.in | Vignan@35632266 |
| EEE | Dr. Polamraju V S Sobhan | polamrajuvssobhan@vignan.ac.in | Vignan@95382361 |
| EEE | Dr. Srinivasarao Gorantla | srinivasaraogorantla@vignan.ac.in | Vignan@46762207 |
| MECH | Dr. B Nageswara Rao | bnageswararao@vignan.ac.in | Vignan@21812187 |
| MECH | Dr. Dusanapudi Satyanarayana | dusanapudisatyanarayana@vignan.ac.in | Vignan@37231289 |
| MECH | Dr. M Ramakrishna | mramakrishna@vignan.ac.in | Vignan@30921370 |
| MECH | Dr. N Narayan Rao | nnarayanrao@vignan.ac.in | Vignan@44909553 |
| MECH | Dr. Y. Jyothi | yjyothi@vignan.ac.in | Vignan@71008827 |
| CIVIL | Dr. A.V.A. Bharat Kumar | avabharatkumar@vignan.ac.in | Vignan@33449965 |
| CIVIL | Dr. Asadi Siva Sankar | asadisivasankar@vignan.ac.in | Vignan@57992295 |
| CIVIL | Dr. P Sundara Kumar | psundarakumar@vignan.ac.in | Vignan@15750792 |
| CIVIL | Mr. Anirudh Maddi | anirudhmaddi@vignan.ac.in | Vignan@12951116 |
| CIVIL | Mr. Dasari Ravi Kanth | dasariravikanth@vignan.ac.in | Vignan@53789340 |
| DMS | Dr. B. Madhusudhan Rao | bmadhusudhanrao@vignan.ac.in | Vignan@40997884 |
| DMS | Dr. Bandaru Srinivasa Rao | bandarusrinivasarao@vignan.ac.in | Vignan@64999171 |
| DMS | Dr. Ch Hymavathi | chhymavathi@vignan.ac.in | Vignan@33424102 |
| DMS | Dr. Dhulipalla Vijay Krishna | dhulipallavijaykrishna@vignan.ac.in | Vignan@21929529 |
| DMS | Dr. K. Siva Nageswara Rao | ksivanageswararao@vignan.ac.in | Vignan@80844766 |
|  | Dr. B. Suvarna | bs_cse@vignan.ac.in | Vignan@80289977 |
|  | Dr. Bhimavarapu Krishna Reddy | bkr_cse@vignan.ac.in | Vignan@82591659 |
|  | Dr. Ch. Siva Koteswara Rao | dr.ch.siva.koteswara.rao.195@vignan.ac.in | Vignan@29642324 |
|  | Dr. Chinna Gopi Simhadri | scg_cse@vignan.ac.in | Vignan@85065820 |
|  | Dr. D. Yakobu | dy_cse@vignan.ac.in | Vignan@56919097 |
|  | Dr. Deepak Chowdary Edara | edc_cse@vignan.ac.in | Vignan@57703165 |
|  | Dr. G Balu Narasimha Rao | gbnr_cse@vignan.ac.in | Vignan@99248322 |
|  | Dr. G Veerabhadra Chary | drgvbc_cse@vignan.ac.in | Vignan@82519750 |
|  | Dr. James Deva Koresh H | drhj_cse@vignan.ac.in | Vignan@98617724 |
|  | Dr. Jhansi Lakshmi Potharlanka | pjl_cse@vignan.ac.in | Vignan@79636923 |
|  | Dr. M Umadevi | druma_cse@vignan.ac.in | Vignan@31070368 |
|  | Dr. M. Rajarao | drmr_cse@vignan.ac.in | Vignan@46617384 |
|  | Dr. Md Oqail Ahmad | drmoa@vignan.ac.in | Vignan@67189333 |
|  | Dr. O. Bhaskar | drob_cse@vignan.ac.in | Vignan@99541616 |
|  | Dr. P. Siva Prasad | drpsp_cse@vignan.ac.in | Vignan@90083049 |
|  | Dr. Phanindra Thota | tp_cse@vignan.ac.in | Vignan@82211227 |
|  | Dr. Prashant Upadhyay | drpu_cse@vignan.ac.in | Vignan@53067264 |
|  | Dr. R Prathap Kumar | rpk_cse@vignan.ac.in | Vignan@25336596 |
|  | Dr. Rambabu Kusuma | drrk_cse@vignan.ac.in | Vignan@27499582 |
|  | Dr. Renugadevi R | rrd_cse@vignan.ac.in | Vignan@11041836 |
|  | Dr. Satish Kumar Satti | sskumar_cse@vignan.ac.in | Vignan@10808733 |
|  | Dr. Saubhagya Ranjan Biswal | drsrb_cse@vignan.ac.in | Vignan@60225883 |
|  | Dr. Sunil Babu Melingi | drmsb_cse@vignan.ac.in | Vignan@97761099 |
|  | Dr. T.R. Rajesh | trr_cse@vignan.ac.in | Vignan@79215626 |
|  | Dr. Vijai Meyyappan Moorthy | drmv_cse@vignan.ac.in | Vignan@33104228 |
|  | Dr. Vijitha Ananthi J. | jva_cse@vignan.ac.in | Vignan@82350474 |
|  | Dr. Vinoj Jothipandian | drjv_cse@vignan.ac.in | Vignan@70251698 |
|  | Dr. Yadlapalli Ramamohan | yrm_cse@vignan.ac.in | Vignan@13217480 |
|  | Mr. . Kiran Kumar Kaveti | kkk_cse@vignan.ac.in | Vignan@50508885 |
|  | Mr. Adavi Aditya Venkateswara Kumar | adaviadityavenkateswarakumar@vignan.ac.in | Vignan@15907097 |
|  | Mr. Akhil Babu Edara | ea_cse@vignan.ac.in | Vignan@39352638 |
|  | Mr. Akula Gopi | akulagopi@vignan.ac.in | Vignan@95848523 |
|  | Mr. Anil Babu Bathula | ab_cse@vignan.ac.in | Vignan@83166797 |
|  | Mr. Anil Madugula | madugulaanil@vignan.ac.in | Vignan@66201408 |
|  | Mr. Badheli Krishnakanth | bkk_cse@vignan.ac.in | Vignan@19890667 |
|  | Mr. Chavva Ravi Kishore Reddy | crkr_cse@vignan.ac.in | Vignan@62175443 |
|  | Mr. Dega Bala Kotaiah | db_cse@vignan.ac.in | Vignan@26667193 |
|  | Mr. Dehtaj Shaik | shaikdehtaj@vignan.ac.in | Vignan@42115012 |
|  | Mr. Gujjula Murali | gm_cse@vignan.ac.in | Vignan@55183946 |
|  | Mr. Hitendra Singh | hitendra.singh.3341@vignan.ac.in | Vignan@12502992 |
|  | Mr. Kanna Hareesh | 251fg04009@vignan.ac.in | Vignan@33979956 |
|  | Mr. Kiran Kumar Kalagadda | kk_cse@vignan.ac.in | Vignan@19566706 |
|  | Mr. Kiran Kumar Raja Pagidipalli | pkk_cse@vignan.ac.in | Vignan@25572407 |
|  | Mr. Kolluru Pavan Kumar | kpk_cse@vignan.ac.in | Vignan@72846193 |
|  | Mr. Kudupudi Raj Kiran | kudupudirajkiran@vignan.ac.in | Vignan@74035116 |
|  | Mr. Kumar Devapogu | dk_cse@vignan.ac.in | Vignan@99982791 |
|  | Mr. Lalu Naick Bhukya | bln_cse@vignan.ac.in | Vignan@44023598 |
|  | Mr. Latesh Babu Talluri | tlateshbabu@vignan.ac.in | Vignan@65362922 |
|  | Mr. Mihir Bhatt | mithir.kaushal.bhatt.3340@vignan.ac.in | Vignan@40513064 |
|  | Mr. Mohana Venkateswara Rao Mathi | mmv_cse@vignan.ac.in | Vignan@36997132 |
|  | Mr. Munipalli Veerendra | munipalliveerendra@vignan.ac.in | Vignan@13565141 |
|  | Mr. Nalluri Brahma Naidu | bn_cse@vignan.ac.in | Vignan@74038641 |
|  | Mr. Ongole Gandhi | og_cse@vignan.ac.in | Vignan@70225988 |
|  | Mr. P Vamsi Krishna | palavellivamsikrishna@vignan.ac.in | Vignan@14361015 |
|  | Mr. Panthgani Vijaya Babu | pvb_cse@vignan.ac.in | Vignan@68819075 |
|  | Mr. Pathan Yaseen Khan | pathanyaseenkhan@vignan.ac.in | Vignan@97709976 |
|  | Mr. Rudru Gowtham | rudrugowtham@vignan.ac.in | Vignan@24277212 |
|  | Mr. S Jayasankar | js_cse@vignan.ac.in | Vignan@65524061 |
|  | Mr. S Suresh Babu | ssb_cse@vignan.ac.in | Vignan@87618112 |
|  | Mr. Senthil D | sd_cse@vignan.ac.in | Vignan@85019645 |
|  | Mr. Shaik Jani | sj_cse@vignan.ac.in | Vignan@21655827 |
|  | Mr. Shaik Sikindar | ssk_cse@vignan.ac.in | Vignan@79066214 |
|  | Mr. Shashi Mani | smi_cse@vignan.ac.in | Vignan@96966977 |
|  | Mr. Shyam Sundar Jannu Soloman | ssj_cse@vignan.ac.in | Vignan@77030981 |
|  | Mr. Sk. Khadersha | shk_cse@vignan.ac.in | Vignan@45259271 |
|  | Mr. Sourav Mondal | svml_cse@vignan.ac.in | Vignan@79723619 |
|  | Mr. Tirumalasetti Narasimha Rao | tnr_cse@vignan.ac.in | Vignan@36644955 |
|  | Mr. Uppala Venkateswara Rao | uvr_cse@vignan.ac.in | Vignan@91311501 |
|  | Mr. Venkata Rajulu Pilli | pvr_cse@vignan.ac.in | Vignan@24571714 |
|  | Mrs. Anusha Kakumanu | ak_cse@vignan.ac.in | Vignan@46193938 |
|  | Mrs. Anusha Viswanadapalli | av_cse@vignan.ac.in | Vignan@37206422 |
|  | Mrs. Guggilam Navya | gn_cse@vignan.ac.in | Vignan@32774499 |
|  | Mrs. Jarugumalla Dayanika | jd_cse@vignan.ac.in | Vignan@88193130 |
|  | Mrs. Kolla Jyotsna | jk_cse@vignan.ac.in | Vignan@15724818 |
|  | Mrs. Magham. Sumalatha | msl_cse@vignan.ac.in | Vignan@74585865 |
|  | Mrs. Maridu Bhargavi | mb_cse@vignan.ac.in | Vignan@29299883 |
|  | Mrs. N. Archana | an_cse@vignan.ac.in | Vignan@30055706 |
|  | Mrs. Nakkala Mounika | nm_cse@vignan.ac.in | Vignan@21810795 |
|  | Mrs. Nalluri Bhargavi | nb_cse@vignan.ac.in | Vignan@10869665 |
|  | Mrs. P. Anusha | pa_cse@vignan.ac.in | Vignan@80474880 |
|  | Mrs. P.S.V.V. Samhitha | psvvsamhitha@vignan.ac.in | Vignan@82656291 |
|  | Mrs. Parimala Garnepudi | gp_cse@vignan.ac.in | Vignan@58005628 |
|  | Mrs. Pathan Razia Sultana | mrs.pathan.razia.sultana.3325@vignan.ac.in | Vignan@47968322 |
|  | Mrs. Pavani Karra | kp_ta_cse@vignan.ac.in | Vignan@35011395 |
|  | Mrs. Ravuri Lalitha | lr_cse@vignan.ac.in | Vignan@84391178 |
|  | Mrs. Sai Eswari Yalavarthi | ys_cse@vignan.ac.in | Vignan@35661010 |
|  | Mrs. Sunkara Anitha | as_cse@vignan.ac.in | Vignan@17046297 |
|  | Mrs. Swarna Lalitha | sl_cse@vignan.ac.in | Vignan@35847558 |
|  | Mrs. Syed. Shareefunnisa | sds_cse@vignan.ac.in | Vignan@70978384 |
|  | Mrs. T. Leelavathy | tl_cse@vignan.ac.in | Vignan@52018824 |
|  | Mrs. Tipura Damarla | dt_cse@vignan.ac.in | Vignan@52887983 |
|  | Mrs. V. Nandini | nv_cse@vignan.ac.in | Vignan@92510884 |
|  | Mrs. V. Sai Spandana | ssv_cse@vignan.ac.in | Vignan@88665246 |
|  | Mrs. Varagani Tejaswi | varaganitejaswi@vignan.ac.in | Vignan@67412457 |
|  | Mrs.G. Prasanthi | pg_cse@vignan.ac.in | Vignan@82977602 |
|  | Ms. Annam Durga Bhavani | dba_cse@vignan.ac.in | Vignan@78492743 |
|  | Ms. Bhimavarapu. Jyothika | bhimavarapujyothika@vignan.ac.in | Vignan@69810852 |
|  | Ms. Bhukya Maneesha | bhukyamaneesha@vignan.ac.in | Vignan@93269669 |
|  | Ms. Christiana R.E Korrapati | cre_cse@vignan.ac.in | Vignan@24053892 |
|  | Ms. G. Siva Naga Malleswari | gsivanagamalleswari@vignan.ac.in | Vignan@95359166 |
|  | Ms. Gaddam Tejaswi | gaddamtejaswi@vignan.ac.in | Vignan@22168874 |
|  | Ms. Gopya Sri Arumalla | arumallagopyasri@vignan.ac.in | Vignan@19738280 |
|  | Ms. Gudipati Sravya | gs_cse@vignan.ac.in | Vignan@54959386 |
|  | Ms. K. Divya | kdivya@vignan.ac.in | Vignan@17283761 |
|  | Ms. Kalluri Mercy Bhikshavathi | kallurimercybhikshavathi@vignan.ac.in | Vignan@40706563 |
|  | Ms. Kollabathula Nimnagasri | kollabathulanimnagasri@vignan.ac.in | Vignan@56160031 |
|  | Ms. Neeli Sarvani | neelisarvani@vignan.ac.in | Vignan@89797193 |
|  | Ms. Nese Bandhike Akhilandeswari | nesebandhikeakhilandeswari@vignan.ac.in | Vignan@71735408 |
|  | Ms. P. Deepthi Sowmya | pdeepthisowmya@vignan.ac.in | Vignan@90942404 |
|  | Ms. Pushya Chaparala | chp_cse@vignan.ac.in | Vignan@50792162 |
|  | Ms. Sajida Sultana. Sk | sks_cse@vignan.ac.in | Vignan@32108212 |
|  | Ms. Shaik Kareena Yashmin | shaikkareenayashmin@vignan.ac.in | Vignan@60503629 |
|  | Ms. Shaik Nazeema | shaiknazeema@vignan.ac.in | Vignan@12732491 |
|  | Ms. Shaik Reehana | rs_cse@vignan.ac.in | Vignan@85237295 |
|  | Ms. Swathi Koganti | sk_cse@vignan.ac.in | Vignan@35126546 |
|  | Ms. Upalanchi Vara Lakshmi | uvl_cse@vignan.ac.in | Vignan@26528203 |
|  | Ms. Vyshnavi Kagga | vyshnavikagga@vignan.ac.in | Vignan@29690113 |
|  | Ms. Y. Sesha Naga Bindu Lalitha Sri | yseshanagabindulalithasri@vignan.ac.in | Vignan@88015919 |
|  | Ms. Yemineni Sravani | yeminenisravani@vignan.ac.in | Vignan@43999187 |
|  | Ms.Vutukuri Geetha Naga Lakshmi | ms.vutukuri.geetha.naga.lakshmi.31262@vignan.ac.in | Vignan@70571704 |
|  | Shaik Charishma | shaik.charishma.31272@vignan.ac.in | Vignan@70128674 |

## Seed / import

```bash
cd backend
npm run db:import:section7
npm run db:section7:logins
npm run db:seed:demo-depts
npm run db:enrich:official
npm run db:sync:official
```

## Engine tests
```bash
cd backend
npm run test:engine
```

## Notes
- Weights/norms come from DB; what-if never writes; mutations recalculate snapshots.
- Agent 25/56 feeds are stub provider interfaces in the HOD module (no fake rows unless you insert them).
