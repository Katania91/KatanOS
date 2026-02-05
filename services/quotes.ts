import { Language } from "./translations";

export interface Quote {
  author: string | Record<string, string>;
  text: Record<string, string>;
}

export const getRandomQuote = (lang: string = 'it'): { text: string, author: string } => {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const q = quotes[randomIndex];
  // Fallback to English if translation is missing, then to Italian
  const text = q.text[lang] || q.text['en'] || q.text['it'];
  const author = typeof q.author === 'string' ? q.author : q.author[lang] || q.author['en'] || q.author['it'];
  return { text, author };
};

const quotes: Quote[] = [
  {
    author: "Steve Jobs",
    text: {
      it: "L'unico modo per fare un ottimo lavoro è amare quello che fai.",
      en: "The only way to do great work is to love what you do.",
      fr: "La seule façon de faire du bon travail est d'aimer ce que vous faites.",
      es: "La única forma de hacer un gran trabajo es amar lo que haces.",
      de: "Der einzige Weg, großartige Arbeit zu leisten, ist zu lieben, was man tut."
    }
  },
  {
    author: "Winston Churchill",
    text: {
      it: "Il successo è la capacità di passare da un fallimento all'altro senza perdere l'entusiasmo.",
      en: "Success is stumbling from failure to failure with no loss of enthusiasm.",
      fr: "Le succès, c'est d'aller d'échec en échec sans perdre son enthousiasme.",
      es: "El éxito es aprender a ir de fracaso en fracaso sin desesperarse.",
      de: "Erfolg ist die Fähigkeit, von einem Misserfolg zum anderen zu gehen, ohne seine Begeisterung zu verlieren."
    }
  },
  {
    author: "Albert Einstein",
    text: {
      it: "La creatività è l'intelligenza che si diverte.",
      en: "Creativity is intelligence having fun.",
      fr: "La créativité, c'est l'intelligence qui s'amuse.",
      es: "La creatividad es la inteligencia divirtiéndose.",
      de: "Kreativität ist Intelligenz, die Spaß hat."
    }
  },
  {
    author: "Nelson Mandela",
    text: {
      it: "Sembra sempre impossibile finché non viene fatto.",
      en: "It always seems impossible until it's done.",
      fr: "Cela semble toujours impossible, jusqu'à ce qu'on le fasse.",
      es: "Siempre parece imposible hasta que se hace.",
      de: "Es scheint immer unmöglich, bis es getan ist."
    }
  },
  {
    author: "Confucio",
    text: {
      it: "Non importa quanto vai piano, l'importante è non fermarsi.",
      en: "It does not matter how slowly you go as long as you do not stop.",
      fr: "Peu importe la lenteur à laquelle vous allez tant que vous ne vous arrêtez pas.",
      es: "No importa lo lento que vayas mientras no te detengas.",
      de: "Es spielt keine Rolle, wie langsam du gehst, solange du nicht stehen bleibst."
    }
  },
  {
    author: "Walt Disney",
    text: {
      it: "Se puoi sognarlo, puoi farlo.",
      en: "If you can dream it, you can do it.",
      fr: "Si vous pouvez le rêver, vous pouvez le faire.",
      es: "Si puedes soñarlo, puedes hacerlo.",
      de: "Wenn du es träumen kannst, kannst du es auch tun."
    }
  },
  {
    author: "Eleanor Roosevelt",
    text: {
      it: "Il futuro appartiene a coloro che credono nella bellezza dei propri sogni.",
      en: "The future belongs to those who believe in the beauty of their dreams.",
      fr: "L'avenir appartient à ceux qui croient à la beauté de leurs rêves.",
      es: "El futuro pertenece a quienes creen en la belleza de sus sueños.",
      de: "Die Zukunft gehört denen, die an die Schönheit ihrer Träume glauben."
    }
  },
  {
    author: "Franklin D. Roosevelt",
    text: {
      it: "L'unico limite alla nostra realizzazione di domani saranno i nostri dubbi di oggi.",
      en: "The only limit to our realization of tomorrow will be our doubts of today.",
      fr: "La seule limite à notre épanouissement de demain sera nos doutes d'aujourd'hui.",
      es: "El único límite para nuestra realización de mañana serán nuestras dudas de hoy.",
      de: "Die einzige Grenze für unsere Verwirklichung von morgen werden unsere Zweifel von heute sein."
    }
  },
  {
    author: "Mahatma Gandhi",
    text: {
      it: "Sii il cambiamento che vuoi vedere nel mondo.",
      en: "Be the change that you wish to see in the world.",
      fr: "Soyez le changement que vous voulez voir dans le monde.",
      es: "Sé el cambio que quieres ver en el mundo.",
      de: "Sei du selbst die Veränderung, die du dir wünschst für diese Welt."
    }
  },
  {
    author: "Theodore Roosevelt",
    text: {
      it: "Credi di potercela fare e sei già a metà strada.",
      en: "Believe you can and you're halfway there.",
      fr: "Croyez que vous pouvez et vous êtes à mi-chemin.",
      es: "Cree que puedes y ya estarás a medio camino.",
      de: "Glaube, dass du es kannst, und du bist schon halb dort."
    }
  },
  {
    author: "Aristotele",
    text: {
      it: "Siamo ciò che facciamo ripetutamente. L'eccellenza, quindi, non è un atto, ma un'abitudine.",
      en: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
      fr: "Nous sommes ce que nous faisons de manière répétée. L'excellence n'est donc pas un acte, mais une habitude.",
      es: "Somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto, sino un hábito.",
      de: "Wir sind das, was wir wiederholt tun. Exzellenz ist also keine Handlung, sondern eine Gewohnheit."
    }
  },
  {
    author: "Leonardo da Vinci",
    text: {
      it: "L'apprendimento non esaurisce mai la mente.",
      en: "Learning never exhausts the mind.",
      fr: "L'apprentissage n'épuise jamais l'esprit.",
      es: "El aprendizaje nunca agota la mente.",
      de: "Lernen erschöpft den Geist nie."
    }
  },
  {
    author: "Dalai Lama",
    text: {
      it: "La felicità non è qualcosa di già pronto. Viene dalle tue azioni.",
      en: "Happiness is not something ready made. It comes from your own actions.",
      fr: "Le bonheur n'est pas quelque chose de tout fait. Il vient de vos propres actions.",
      es: "La felicidad no es algo hecho. Proviene de tus propias acciones.",
      de: "Glück ist nichts Fertiges. Es kommt aus deinen eigenen Handlungen."
    }
  },
  {
    author: "Maya Angelou",
    text: {
      it: "Ho imparato che la gente si dimenticherà di cosa hai detto, si dimenticherà di cosa hai fatto, ma non si dimenticherà mai di come li hai fatti sentire.",
      en: "I've learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.",
      fr: "J'ai appris que les gens oublieront ce que vous avez dit, ce que vous avez fait, mais n'oublieront jamais ce que vous leur avez fait ressentir.",
      es: "He aprendido que la gente olvidará lo que dijiste, olvidará lo que hiciste, pero nunca olvidará cómo les hiciste sentir.",
      de: "Ich habe gelernt, dass die Leute vergessen, was du gesagt hast, aber nie vergessen, wie du sie gefühlt hast."
    }
  },
  {
    author: "Bruce Lee",
    text: {
      it: "Se ami la vita, non sprecare tempo, perché il tempo è ciò di cui è fatta la vita.",
      en: "If you love life, don't waste time, for time is what life is made up of.",
      fr: "Si vous aimez la vie, ne perdez pas de temps, car le temps est ce dont la vie est faite.",
      es: "Si amas la vida, no pierdas el tiempo, porque de tiempo está hecha la vida.",
      de: "Wenn du das Leben liebst, verschwende keine Zeit, denn Zeit ist das, woraus das Leben besteht."
    }
  },
  {
    author: "Vincent Van Gogh",
    text: {
      it: "Grandi cose non sono fatte da un impulso, ma da una serie di piccole cose messe insieme.",
      en: "Great things are not done by impulse, but by a series of small things brought together.",
      fr: "Les grandes choses ne se font pas par impulsion, mais par une série de petites choses rassemblées.",
      es: "Las grandes cosas no se hacen por impulso, sino por una serie de pequeñas cosas reunidas.",
      de: "Große Dinge entstehen nicht durch Impulse, sondern durch eine Reihe kleiner Dinge, die zusammenkommen."
    }
  },
  {
    author: "Mark Twain",
    text: {
      it: "Il segreto per andare avanti è iniziare.",
      en: "The secret of getting ahead is getting started.",
      fr: "Le secret pour avancer, c'est de commencer.",
      es: "El secreto para salir adelante es comenzar.",
      de: "Das Geheimnis des Vorwärtskommens besteht darin, anzufangen."
    }
  },
  {
    author: "Platone",
    text: {
      it: "L'inizio è la parte più importante del lavoro.",
      en: "The beginning is the most important part of the work.",
      fr: "Le début est la partie la plus importante du travail.",
      es: "El comienzo es la parte más importante del trabajo.",
      de: "Der Anfang ist der wichtigste Teil der Arbeit."
    }
  },
  {
    author: "Seneca",
    text: {
      it: "Non è perché le cose sono difficili che non osiamo, è perché non osiamo che sono difficili.",
      en: "It is not because things are difficult that we do not dare, it is because we do not dare that they are difficult.",
      fr: "Ce n'est pas parce que les choses sont difficiles que nous n'osons pas, c'est parce que nous n'osons pas qu'elles sont difficiles.",
      es: "No es porque las cosas sean difíciles que no nos atrevemos, es porque no nos atrevemos que son difíciles.",
      de: "Nicht weil es schwer ist, wagen wir es nicht, sondern weil wir es nicht wagen, ist es schwer."
    }
  },
  {
    author: "J.K. Rowling",
    text: {
      it: "È la qualità delle proprie convinzioni che determina il successo, non il numero dei seguaci.",
      en: "It is the quality of one's convictions that determines success, not the number of followers.",
      fr: "C'est la qualité de ses convictions qui détermine le succès, pas le nombre de suiveurs.",
      es: "Es la calidad de las convicciones lo que determina el éxito, no el número de seguidores.",
      de: "Es ist die Qualität der Überzeugungen, die den Erfolg bestimmt, nicht die Anzahl der Anhänger."
    }
  },
  // Adding more generics to simulate a larger list
  {
    author: {
      it: "Proverbio Cinese",
      en: "Chinese Proverb",
      fr: "Proverbe chinois",
      es: "Proverbio chino",
      de: "Chinesisches Sprichwort"
    },
    text: {
      it: "Un viaggio di mille miglia comincia con un singolo passo.",
      en: "A journey of a thousand miles begins with a single step.",
      fr: "Un voyage de mille lieues commence toujours par un premier pas.",
      es: "Un viaje de mil millas comienza con un solo paso.",
      de: "Eine Reise von tausend Meilen beginnt mit einem einzigen Schritt."
    }
  },
  {
    author: "Henry Ford",
    text: {
      it: "Che tu creda di farcela o di non farcela, hai ragione.",
      en: "Whether you think you can, or you think you can't – you're right.",
      fr: "Que vous pensiez être capable ou ne pas être capable, dans les deux cas, vous avez raison.",
      es: "Tanto si piensas que puedes, como si piensas que no puedes, estás en lo cierto.",
      de: "Ob du denkst, du kannst es, oder du kannst es nicht: Du wirst auf jeden Fall recht behalten."
    }
  },
  {
    author: "Oscar Wilde",
    text: {
      it: "Sii te stesso; tutti gli altri sono già presi.",
      en: "Be yourself; everyone else is already taken.",
      fr: "Soyez vous-même, les autres sont déjà pris.",
      es: "Sé tú mismo; los demás ya están cogidos.",
      de: "Sei du selbst! Alle anderen sind bereits vergeben."
    }
  }
];
