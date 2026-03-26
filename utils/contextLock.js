// ============================================
// contextLock.js
// VAD DEN GÖR: Löser konflikter i kontext-slots (stad/område/fordon) och hindrar stale area vid stadsbyte.
// ANVÄNDS AV: legacy_engine.js
// ============================================

module.exports = {
  /**
   * Löser stad-slot: explicit stad har företräde framför sparad stad.
   */
  resolveCity({ savedCity, explicitCity }) {
    if (explicitCity && typeof explicitCity === "string") {
      return explicitCity;
    }
    if (savedCity && typeof savedCity === "string") {
      return savedCity;
    }
    return null;
  },

  /**
   * Löser fordon-slot: explicit fordon har företräde framför sparat.
   */
  resolveVehicle({ savedVehicle, explicitVehicle }) {
    if (explicitVehicle && typeof explicitVehicle === "string") {
      return explicitVehicle;
    }
    if (savedVehicle && typeof savedVehicle === "string") {
      return savedVehicle;
    }
    return null;
  },

  /**
   * Löser område-slot: om staden ändrades rensas sparat område för att undvika
   * att ett område från en annan stad återanvänds (t.ex. Ullevi i Eslöv).
   */
  resolveArea({ savedArea, explicitArea, cityChanged }) {
    if (explicitArea && typeof explicitArea === "string") {
      return explicitArea;
    }
    
    // Om staden har ändrats, måste vi rensa sparat område (annars får vi Ullevi i Eslöv).
    if (cityChanged) {
      return null;
    }

    if (savedArea && typeof savedArea === "string") {
      return savedArea;
    }
    return null;
  },

  /**
   * Returnerar den uppdaterade, låsta kontexten.
   */
  resolveContext({ savedCity, savedArea, savedVehicle }, { explicitCity, explicitArea, explicitVehicle }) {
    
    const city = this.resolveCity({ savedCity, explicitCity });
    const vehicle = this.resolveVehicle({ savedVehicle, explicitVehicle });
    
    // Kolla om staden faktiskt ändrades i detta anrop
    // (explicitCity finns och skiljer sig från savedCity → cityChanged = true)
    let cityChanged = false;
    if (explicitCity && savedCity && explicitCity.toLowerCase() !== savedCity.toLowerCase()) {
        cityChanged = true;
    } else if (explicitCity && !savedCity) {
        cityChanged = true;
    }

    const area = this.resolveArea({ savedArea, explicitArea, cityChanged });

    return { city, area, vehicle };
  }
};