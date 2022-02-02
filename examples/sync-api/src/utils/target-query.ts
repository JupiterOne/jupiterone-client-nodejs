const codeModules = [
  "'hizurur'",
  "'carnud'",
  "'vici'",
  "'iti'",
  "'jifguilo'",
  "'kiwoj'",
  "'juvhove'",
];

export const targetQuery = `
    FIND CodeModule
    WITH displayName = (${codeModules.join(' OR ')})
    AND from = 'testing'
    THAT USES << CodeRepo
`;
