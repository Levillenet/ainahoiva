export interface TestScenario {
  label: string;
  description: string;
  turns: string[];
}

export const TEST_SCENARIOS: TestScenario[] = [
  {
    label: "Luettelo-sisarukset",
    description: "Vanhus luettelee sisaruksia — testaa osaako Aina syventyä",
    turns: [
      "Mulla oli kolme sisarusta. Pentti oli vanhin, sitten minä, sitten Helvi.",
      "Pentti oli kalastaja Ahvenanmaalla.",
      "Helvi muutti Ruotsiin 60-luvulla ja jäi sinne.",
    ],
  },
  {
    label: "Ammatti-ohimennen",
    description: "Vanhus mainitsee isän ammatin lyhyesti — kannustaako Aina jatkamaan?",
    turns: [
      "Lapsuus oli ihan tavallista. Isä oli meillä seppä.",
      "Ei siitä nyt sen kummempaa.",
    ],
  },
  {
    label: "Torjunta",
    description: "Testaa osaako Aina siirtyä lempeästi toiseen aiheeseen",
    turns: [
      "Sisarukset kyllä... mutta en halua puhua siitä.",
    ],
  },
  {
    label: "Lyhyet vastaukset",
    description: "Vanhus vastaa minimaalisesti — osaako Aina kysyä eri tavalla?",
    turns: [
      "En muista.",
      "Joo.",
      "Ehkä.",
    ],
  },
  {
    label: "Pitkä monologi",
    description: "Pitkä rikas tarina — osaako Aina poimia kiinnostavan yksityiskohdan?",
    turns: [
      "No kun minä muutin Helsinkiin 1962, niin kaikki oli erilaista. Junaan nousin Imatralla äidin kanssa ja hän itki koko matkan vaikka yritti peittää. Mukana oli ruskea pahvi matkalaukku, ja mullakin oli omat eväät jotka loppui ennen Kouvolaa. Liisan kanssa asuin sitten Tähtitorninkadulla ja sieltä käsin käytiin töissä rouva Saarnion ompelimossa joka oli Töölössä.",
    ],
  },
  {
    label: "Numerot ja vuodet",
    description: "Tarkka faktatieto — osaako Aina käsitellä menetystä lempeästi?",
    turns: [
      "Paavo kuoli 1998, 67-vuotiaana, keuhkokuumeeseen.",
    ],
  },
  {
    label: "Esine-maininta",
    description: "Esineen kautta muistoon — tarttuuko Aina hopealusikkaan?",
    turns: [
      "Mullon vieläkin se hopealusikka jonka äiti antoi.",
    ],
  },
  {
    label: "Tyhjä menneisyys",
    description: "Testaa 'mitä sinulle kerrottiin' -tekniikkaa",
    turns: [
      "Sota-ajasta en oikein muista mitään. Olin niin pieni.",
    ],
  },
  {
    label: "Päällekkäinen tunne",
    description: "Ristiriitainen muisto äidistä — analysoi Aina vai antaako tilaa?",
    turns: [
      "No äiti oli sellainen... rauhallinen mutta kuitenkin aika ankara. Ei siitä voi oikein sanoa.",
    ],
  },
  {
    label: "Rönsyily",
    description: "Useita aiheita yhdessä vuorossa — mihin Aina tarttuu?",
    turns: [
      "Helvi siis muutti Ruotsiin. Mutta siihen liittyi se että Tauno sairastui juuri silloin ja äiti ei päässyt käymään. Se oli surullista. Tauno toipui kuitenkin, meni lääkäriksi.",
    ],
  },
];
