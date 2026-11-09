// Las 200 palabras con las que están escritas las tandas de VRChat (1–5).
// No existe un corpus público de VRChat, así que la lista sale de las palabras
// más frecuentes del inglés hablado (conversación informal, no texto escrito)
// más el vocabulario que se oye en cualquier instancia: micro, avatar, mundo…
// Las contracciones cuentan como palabra propia porque así se dicen.
// validar-frases.mts exige que las frases de VRChat usen solo estas.
// Las entrevistas (tandas 6–10) usan vocabulario adicional cubierto por dictionary.ts.
export const PALABRAS_CONVERSACION: string[] = [
// pronombres y determinantes
"i","me","my","you","your","he","him","she","her","it","we","us","they","them",
"this","that","a","the","some","any","all","no","one","other","more","lot",
"someone","something","everyone","every",
// contracciones
"i'm","i'll","it's","that's","what's","let's","don't","can't","didn't",
"you're","he's","she's","how's","gonna",
// verbos
"is","are","was","were","be","been","do","did","doing","have","had",
"can","could","would","should",
"go","going","get","got","know","think","see","come","coming","want","like","love",
"say","tell","talk","talking","hear","look","make","help","join","send","show","find",
"mean","remember","feel","need","meet","play","live","sleep","work","working","wait",
"stop","mute","give","take","let","happened",
// sustantivos
"time","day","night","week","people","friend","friends","name","thing","way","world",
"game","games","music","voice","mic","avatar","vr","discord","request","fun","bit",
"guys","today","tonight",
// adjetivos
"good","great","nice","cool","bad","better","new","sure","funny","weird","tired",
"happy","ready","loud","real","little","long","hard","first","next","same","favorite",
// adverbios, conectores y muletillas
"and","but","or","so","if","to","of","in","on","at","for","with","from","about",
"up","out","back","over","around","here","there","now","then","later","soon","yet",
"what","where","when","why","how","who",
"just","really","too","again","still","maybe","well","never","not","right","tomorrow",
"yeah","yes","okay","oh","hey","hi","bye","please","thanks","sorry"
];
