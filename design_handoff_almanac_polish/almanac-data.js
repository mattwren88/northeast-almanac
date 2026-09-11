/* Data for the Almanac recreations.
   Events verbatim from northeast-almanac/public/mock-events.json;
   CATEGORIES + WEATHER verbatim from src/lib/data.js.
   Day 0 is anchored to Sat 18 April 2026 (the mock set's own weekday rhythm). */
(function () {
  const CATEGORIES = {
    market: { label: 'Markets', color: '#E07A1F', icon: '🛍' },
    food: { label: 'Food & Drink', color: '#D63838', icon: '🍴' },
    outdoor: { label: 'Outdoors', color: '#2F8F4E', icon: '🌲' },
    art: { label: 'Art', color: '#7A3FBF', icon: '🎨' },
    performance: { label: 'Theater & Music', color: '#D6248A', icon: '🎭' },
    nightlife: { label: 'Nightlife', color: '#1F5FCC', icon: '🌙' },
    community: { label: 'Community', color: '#C9A227', icon: '👥' },
  };

  const WEATHER = [
    { day: 0, label: 'Sat', cond: 'sun', high: 68, low: 49, icon: '☀' },
    { day: 1, label: 'Sun', cond: 'partly', high: 71, low: 52, icon: '⛅' },
    { day: 2, label: 'Mon', cond: 'rain', high: 58, low: 46, icon: '☂' },
    { day: 3, label: 'Tue', cond: 'rain', high: 55, low: 44, icon: '☂' },
    { day: 4, label: 'Wed', cond: 'partly', high: 64, low: 47, icon: '⛅' },
    { day: 5, label: 'Thu', cond: 'sun', high: 72, low: 51, icon: '☀' },
    { day: 6, label: 'Fri', cond: 'sun', high: 75, low: 54, icon: '☀' },
    { day: 7, label: 'Sat', cond: 'sun', high: 77, low: 56, icon: '☀' },
    { day: 8, label: 'Sun', cond: 'partly', high: 73, low: 55, icon: '⛅' },
    { day: 9, label: 'Mon', cond: 'partly', high: 69, low: 52, icon: '⛅' },
    { day: 10, label: 'Tue', cond: 'sun', high: 74, low: 53, icon: '☀' },
    { day: 11, label: 'Wed', cond: 'rain', high: 60, low: 48, icon: '☂' },
    { day: 12, label: 'Thu', cond: 'partly', high: 65, low: 50, icon: '⛅' },
    { day: 13, label: 'Fri', cond: 'sun', high: 71, low: 54, icon: '☀' },
  ];

  const AUDIENCES = {
    community: { label: 'Community', description: 'Public events from regional venues and publishers' },
    college: { label: 'Colleges', description: 'University of Scranton, Marywood, Keystone (lots of academic dates)' },
  };

  const EVENTS = [
    { id: 'e01', title: 'Spring Makers Market', venue: 'The Marketplace at Steamtown', town: 'Scranton', day: 0, start: '10:00', end: '16:00', category: 'market', price: 'Free', indoor: true, featured: true, hidden: false, blurb: 'Forty-plus regional vendors — letterpress prints, fermented hot sauce, hand-thrown pottery, and the usual honey-soap suspects. The Earth Day overflow crowd, basically.', tags: ['vendors', 'family', 'indoor'] },
    { id: 'e02', title: 'Lace Village Open Studios', venue: 'Scranton Lace Building', town: 'Scranton', day: 0, start: '11:00', end: '17:00', category: 'art', price: 'Free', indoor: true, featured: true, hidden: false, blurb: 'Twenty-two artists open their studios across three floors of the old lace works. Expect half-finished canvases, free coffee, and at least one cat.', tags: ['art', 'studios', 'indoor'] },
    { id: 'e03', title: 'Tilbury Knob Trail Day', venue: 'Pinchot State Forest', town: 'Plains Twp', day: 0, start: '09:00', end: '13:00', category: 'outdoor', price: 'Free', indoor: false, featured: false, hidden: true, blurb: 'Volunteer trail-clearing followed by a moderate 3-mile out-and-back. Bring loppers if you have them; coffee and donuts at the trailhead.', tags: ['hiking', 'volunteer'] },
    { id: 'e04', title: 'Mauch Chunk Opera House: Tig Notaro', venue: 'Mauch Chunk Opera House', town: 'Jim Thorpe', day: 0, start: '20:00', end: '22:00', category: 'performance', price: '$48', indoor: true, featured: false, hidden: false, blurb: 'Stand-up in the 1881 opera house. Dry as kindling. Sold out balcony, a few mains left.', tags: ['comedy', 'theater'] },
    { id: 'e05', title: 'AFA Gallery: "Rust & Bloom" Opening', venue: 'AFA Gallery', town: 'Scranton', day: 0, start: '18:00', end: '21:00', category: 'art', price: 'Free', indoor: true, featured: false, hidden: false, blurb: 'Six painters working from the iron-furnace landscapes of the lower Lackawanna. Wine in plastic cups. Linger.', tags: ['gallery', 'opening'] },
    { id: 'e06', title: 'Backyard Ale House: Sour Beer Fest', venue: 'Backyard Ale House', town: 'Scranton', day: 0, start: '14:00', end: '23:00', category: 'food', price: '$15 flight', indoor: true, featured: false, hidden: false, blurb: 'Twelve sours on tap from Susquehanna, Nimble Hill, Wallenpaupack, and a few from across the river. Pretzel knots gratis.', tags: ['beer', 'nightlife'] },
    { id: 'e07', title: 'Co-Op Farmers Market', venue: 'Cooperage Project', town: 'Honesdale', day: 1, start: '10:00', end: '14:00', category: 'market', price: 'Free', indoor: false, featured: false, hidden: false, recurring: 'Every Sunday', blurb: 'Small but mighty — six farms, a bread guy, the fermented-everything woman. Done by two.', tags: ['farmers market', 'recurring'] },
    { id: 'e08', title: 'Glen Onoko Falls Guided Hike', venue: 'Lehigh Gorge State Park', town: 'Jim Thorpe', day: 1, start: '09:30', end: '13:00', category: 'outdoor', price: '$10', indoor: false, featured: true, hidden: false, blurb: 'Ranger-led, 4 miles, three waterfalls. The trail technically remains closed, which is half the appeal.', tags: ['hiking', 'waterfalls'] },
    { id: 'e09', title: 'Pittston Tomato Festival Planning Potluck', venue: 'American Legion Post 542', town: 'Pittston', day: 1, start: '17:00', end: '20:00', category: 'food', price: 'Free / BYO dish', indoor: true, featured: false, hidden: true, blurb: 'Yes, the festival is in August. Yes, they are already arguing about parade routes. Bring a salad.', tags: ['community', 'hidden gem'] },
    { id: 'e10', title: 'Houdini Museum Séance Tour', venue: 'Houdini Museum', town: 'Scranton', day: 1, start: '14:00', end: '15:30', category: 'performance', price: '$18', indoor: true, featured: false, hidden: false, blurb: 'Dorothy Dietrich performs, then walks you through the collection. Camp, sincere, a little spooky.', tags: ['museum', 'magic'] },
    { id: 'e11', title: 'Trivia at Whistles Pub', venue: 'Whistles Pub & Eatery', town: 'Clarks Summit', day: 2, start: '19:30', end: '21:30', category: 'nightlife', price: 'Free', indoor: true, featured: false, hidden: false, recurring: 'Every Monday', blurb: 'Five rounds, host is mean in a fun way, prize is a $25 tab. Get there by 7.', tags: ['trivia', 'recurring'] },
    { id: 'e12', title: 'Stroudsburg Sketch Night', venue: 'Sherman Theater Lobby', town: 'Stroudsburg', day: 2, start: '18:30', end: '21:00', category: 'art', price: '$5', indoor: true, featured: false, hidden: true, recurring: 'Every other Monday', blurb: 'Bring a pad. Live model, three poses, no critique. BYOB tolerated.', tags: ['drawing', 'hidden gem'] },
    { id: 'e13', title: 'AOC Reading Series: Naomi Shihab Nye', venue: 'Hawley Silk Mill', town: 'Hawley', day: 3, start: '19:00', end: '20:30', category: 'performance', price: '$12', indoor: true, featured: true, hidden: false, blurb: 'New poems, old poems, Q&A. Books for sale; she will sign anything you put in front of her.', tags: ['poetry', 'reading'] },
    { id: 'e27', title: 'Olive Branch: Open Mic', venue: 'The Olive Branch', town: 'Wilkes-Barre', day: 3, start: '20:00', end: '23:00', category: 'nightlife', price: 'Free', indoor: true, featured: false, hidden: false, recurring: 'Tuesdays', blurb: 'Two-song limit, sign up by 7:45. Mostly singer-songwriter, occasional spoken word.', tags: ['open mic', 'recurring'] },
    { id: 'e14', title: 'Wednesday Night Cruise-In', venue: 'Circle Drive-In', town: 'Dickson City', day: 4, start: '17:00', end: '21:00', category: 'community', price: 'Free', indoor: false, featured: false, hidden: false, recurring: 'Wednesdays through Sept', blurb: 'Pre-1985 cars, a snack bar that takes cash only, and people who will tell you about their carburetor at length.', tags: ['cars', 'recurring'] },
    { id: 'e15', title: 'WB Public Sq. Farmers Market', venue: 'Public Square', town: 'Wilkes-Barre', day: 4, start: '10:00', end: '14:00', category: 'market', price: 'Free', indoor: false, featured: false, hidden: false, recurring: 'Wednesdays', blurb: 'Bigger than the Sunday Honesdale market, wider produce range, plus the empanada truck.', tags: ['farmers market', 'recurring'] },
    { id: 'e16', title: 'First Thursday Gallery Walk', venue: 'Various — Courthouse Sq area', town: 'Scranton', day: 5, start: '17:00', end: '21:00', category: 'art', price: 'Free', indoor: true, featured: true, hidden: false, blurb: 'Eight galleries, one route, free shuttle that no one uses because everything is two blocks apart.', tags: ['gallery', 'walking'] },
    { id: 'e17', title: 'POSH @ Scranton Club: First Thursday Late', venue: 'POSH at the Scranton Club', town: 'Scranton', day: 5, start: '21:00', end: '24:00', category: 'nightlife', price: '$10', indoor: true, featured: false, hidden: false, blurb: 'DJ set after the gallery walk. The dress code is "you tried."', tags: ['dj', 'nightlife'] },
    { id: 'e18', title: 'Scranton Cultural Center: Hadestown', venue: 'Scranton Cultural Center', town: 'Scranton', day: 6, start: '20:00', end: '22:30', category: 'performance', price: '$55–$120', indoor: true, featured: true, hidden: false, blurb: 'The touring company. Masonic Temple acoustics. Park in the deck across Adams.', tags: ['theater', 'touring'] },
    { id: 'e19', title: 'Pocono Brewery Co. Friday Lineup', venue: 'Pocono Brewery Co.', town: 'Swiftwater', day: 6, start: '18:00', end: '23:00', category: 'nightlife', price: 'Free entry', indoor: true, featured: false, hidden: false, blurb: 'Three local bands, food truck out back, kids welcome until 9.', tags: ['live music', 'beer'] },
    { id: 'e20', title: 'Jim Thorpe Bike Week Kickoff', venue: 'Josiah White Park', town: 'Jim Thorpe', day: 7, start: '09:00', end: '17:00', category: 'outdoor', price: 'Free', indoor: false, featured: true, hidden: false, blurb: 'Demo bikes from four shops, a slow-race, the gravel ride at 11. Train into town to skip parking.', tags: ['cycling', 'family'] },
    { id: 'e21', title: 'Old Jail Museum Lantern Tour', venue: 'Old Jail Museum', town: 'Jim Thorpe', day: 7, start: '20:00', end: '21:30', category: 'performance', price: '$22', indoor: true, featured: false, hidden: true, blurb: 'Cell 17 by lantern only. The handprint thing. Skeptics welcome and gently challenged.', tags: ['history', 'hidden gem'] },
    { id: 'e22', title: 'Steamtown Train Day', venue: 'Steamtown National Historic Site', town: 'Scranton', day: 7, start: '10:00', end: '16:00', category: 'community', price: '$7', indoor: false, featured: false, hidden: false, blurb: 'Cab tours of the Big Boy 4012, model railroad in the roundhouse, kids ride free.', tags: ['family', 'trains'] },
    { id: 'e23', title: 'Lackawanna State Park Guided Birding', venue: 'Lackawanna State Park', town: 'North Abington Twp', day: 8, start: '07:00', end: '10:00', category: 'outdoor', price: 'Free', indoor: false, featured: false, hidden: false, blurb: 'Warblers are moving. Bring binoculars or borrow a pair. Coffee at Glenburn after.', tags: ['birding', 'morning'] },
    { id: 'e24', title: 'Stroudsburg Antiques on the Square', venue: 'Courthouse Square', town: 'Stroudsburg', day: 8, start: '09:00', end: '15:00', category: 'market', price: 'Free', indoor: false, featured: false, hidden: false, blurb: 'Fifty dealers, the good kind of overpriced. Stop at Sycamore for breakfast first.', tags: ['antiques', 'outdoor'] },
    { id: 'e26', title: 'Pittston Sunday Slow Roll', venue: 'Riverfront Park', town: 'Pittston', day: 8, start: '11:00', end: '13:00', category: 'outdoor', price: 'Free', indoor: false, featured: false, hidden: true, recurring: 'Every Sunday', blurb: 'Casual ten-mph group ride along the river trail. Any bike, any age.', tags: ['cycling', 'recurring', 'hidden gem'] },
    { id: 'e25', title: 'F.M. Kirby: PA Symphonic Pops', venue: 'F.M. Kirby Center', town: 'Wilkes-Barre', day: 11, start: '19:30', end: '22:00', category: 'performance', price: '$28–$65', indoor: true, featured: false, hidden: false, blurb: 'John Williams night. Bring earplugs for the brass section if you sit close.', tags: ['orchestra'] },
  ];

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ANCHOR = '2026-04-18';

  function dateForDay(d) {
    const dt = new Date(new Date(ANCHOR + 'T00:00:00').getTime() + d * 86400000);
    return { weekday: DAYS[dt.getDay()], month: MONTHS[dt.getMonth()], date: dt.getDate() };
  }
  function fmtTime(t) {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${hh} ${ampm}` : `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  const TOWNS = [...new Set(EVENTS.map(e => e.town))].sort((a, b) => a.localeCompare(b));

  window.ALMANAC = { CATEGORIES, WEATHER, AUDIENCES, EVENTS, TOWNS, dateForDay, fmtTime, ANCHOR };
})();
