/**
 * Deterministic fallback plan generator for demo/offline mode.
 * Generates useful, event-specific suggestions without claiming AI generated them.
 * All amounts in minor currency units.
 */

import type { EventBasicInfo, EventBudgetInfo, EventPreferences, AIPlan } from '@/types/event';
import { EVENT_TYPE_LABELS } from '@/types/event';

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function getDateBefore(eventDate: string, daysBefore: number): string {
  return addDays(eventDate, -daysBefore);
}

function clampDate(dateStr: string, minDate: string): string {
  if (dateStr < minDate) return minDate;
  return dateStr;
}

export function generateDemoPlan(
  basicInfo: EventBasicInfo,
  budgetInfo: EventBudgetInfo,
  preferences: EventPreferences
): AIPlan {
  const eventTypeLabel = EVENT_TYPE_LABELS[basicInfo.type] || 'Event';
  const budget = budgetInfo.totalBudget;
  const guests = basicInfo.guestCount;
  const isLarge = guests > 100;
  const today = new Date().toISOString().split('T')[0];

  // Budget allocation varies by event type
  const budgetAllocation = getBudgetAllocation(basicInfo.type, budget, guests);

  // Generate concept based on preferences
  const concept = generateConcept(basicInfo, preferences);

  // Generate timeline
  const timeline = generateTimeline(basicInfo, budgetInfo, today);

  // Generate vendor checklist
  const vendorChecklist = generateVendorChecklist(basicInfo);

  // Generate ideas
  const ideas = generateIdeas(basicInfo, budgetInfo, preferences);

  // Generate contingencies
  const contingencies = generateContingencies(basicInfo);

  return {
    eventSummary: `A ${eventTypeLabel.toLowerCase()} for ${guests} guests in ${basicInfo.location}, planned with a budget of approximately ${(budget / 100).toLocaleString()} ${budgetInfo.currency}. ${isLarge ? 'This is a large-scale event requiring careful coordination across multiple vendors and logistics.' : 'This is an intimate gathering focused on creating memorable personal experiences.'} These suggestions are generated locally for planning purposes.`,
    concept,
    budget: budgetAllocation,
    timeline,
    vendorChecklist,
    ideas,
    contingencies,
  };
}

function getBudgetAllocation(eventType: string, totalBudget: number, guests: number) {
  const allocations: Record<string, { category: string; percentage: number; reason: string }[]> = {
    wedding: [
      { category: 'Venue', percentage: 25, reason: 'Venue is typically the largest expense for weddings' },
      { category: 'Food & Catering', percentage: 30, reason: 'Quality catering is essential for guest satisfaction' },
      { category: 'Photography & Video', percentage: 12, reason: 'Capturing memories is a priority for most couples' },
      { category: 'Decoration', percentage: 10, reason: 'Setting the right ambiance for the ceremony and reception' },
      { category: 'Entertainment', percentage: 5, reason: 'Music and entertainment for the reception' },
      { category: 'Attire & Beauty', percentage: 5, reason: 'Wedding attire and grooming' },
      { category: 'Invitations & Stationery', percentage: 3, reason: 'Wedding invitations and day-of stationery' },
      { category: 'Transportation', percentage: 3, reason: 'Guest and bridal party transportation' },
      { category: 'Contingency', percentage: 7, reason: 'Reserve for unexpected expenses' },
    ],
    birthday: [
      { category: 'Venue', percentage: 20, reason: 'Venue or party space rental' },
      { category: 'Food & Catering', percentage: 30, reason: 'Food, drinks, and birthday cake' },
      { category: 'Decoration', percentage: 15, reason: 'Party decorations and theme setup' },
      { category: 'Entertainment', percentage: 15, reason: 'Activities, games, and entertainment' },
      { category: 'Photography', percentage: 5, reason: 'Capturing party moments' },
      { category: 'Cake & Bakery', percentage: 5, reason: 'Custom birthday cake' },
      { category: 'Invitations', percentage: 2, reason: 'Party invitations' },
      { category: 'Contingency', percentage: 8, reason: 'Reserve for extras' },
    ],
    community: [
      { category: 'Venue & Permits', percentage: 25, reason: 'Venue rental and necessary permits' },
      { category: 'Food & Refreshments', percentage: 20, reason: 'Refreshments for attendees' },
      { category: 'Equipment', percentage: 15, reason: 'Audio/visual and technical equipment' },
      { category: 'Promotion', percentage: 10, reason: 'Marketing and outreach materials' },
      { category: 'Decoration', percentage: 8, reason: 'Event decoration and signage' },
      { category: 'Logistics', percentage: 7, reason: 'Setup, teardown, and coordination' },
      { category: 'Safety & Security', percentage: 5, reason: 'Crowd management and first aid' },
      { category: 'Accessibility', percentage: 3, reason: 'Accessibility accommodations' },
      { category: 'Contingency', percentage: 7, reason: 'Unexpected expenses buffer' },
    ],
  };

  const defaultAlloc = allocations.birthday; // Default for other event types
  const alloc = allocations[eventType] || defaultAlloc;

  // Adjust for guest count: larger events need proportionally more catering
  const guestFactor = guests > 200 ? 1.1 : guests > 50 ? 1.0 : 0.9;

  return alloc.map((item) => ({
    category: item.category,
    estimatedAmount: Math.round((totalBudget * item.percentage * guestFactor) / 100),
    reason: item.reason,
  }));
}

function generateConcept(basicInfo: EventBasicInfo, preferences: EventPreferences) {
  const concepts: Record<string, { name: string; description: string; colors: string[]; rationale: string }> = {
    wedding: {
      name: 'Timeless Elegance',
      description: 'A sophisticated celebration blending classic elegance with modern touches, featuring warm lighting, flowing fabrics, and refined details.',
      colors: ['#4A3728', '#D4A574', '#F5E6D3', '#8B6F5E', '#FFFFFF'],
      rationale: 'This concept creates a warm, sophisticated atmosphere suitable for a memorable wedding celebration.',
    },
    birthday: {
      name: 'Joyful Celebration',
      description: 'A vibrant, fun-filled party designed to create lasting memories with playful decorations, interactive activities, and personalized touches.',
      colors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#2C3E50', '#FFFFFF'],
      rationale: 'Bright, energetic colors and a lively atmosphere perfect for a birthday celebration.',
    },
    community: {
      name: 'Community Together',
      description: 'An inclusive, well-organized gathering focused on bringing people together with engaging activities, comfortable spaces, and accessible design.',
      colors: ['#2D5F2D', '#F4A460', '#87CEEB', '#333333', '#FAFAFA'],
      rationale: 'Natural, welcoming colors that promote a sense of community and belonging.',
    },
  };

  const defaultConcept = concepts.birthday;
  const concept = concepts[basicInfo.type] || defaultConcept;

  // Override colors if user specified palette
  const colors = preferences.colorPalette
    ? parseUserColors(preferences.colorPalette, concept.colors)
    : concept.colors;

  // Override name if user specified theme
  const name = preferences.theme || concept.name;

  return {
    name,
    description: concept.description,
    colorPalette: colors,
    rationale: concept.rationale,
  };
}

function parseUserColors(paletteStr: string, fallback: string[]): string[] {
  const hexRegex = /#[0-9a-fA-F]{6}/g;
  const matches = paletteStr.match(hexRegex);
  if (matches && matches.length >= 2) {
    return matches.slice(0, 5);
  }
  return fallback;
}

function generateTimeline(
  basicInfo: EventBasicInfo,
  budgetInfo: EventBudgetInfo,
  today: string
) {
  const eventDate = basicInfo.date;
  const daysUntil = Math.ceil(
    (new Date(eventDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)
  );

  type TimelineTask = {
    title: string;
    description: string;
    daysBefore: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: 'venue' | 'catering' | 'decoration' | 'photography' | 'entertainment' | 'logistics' | 'invitations' | 'attire' | 'transportation' | 'accessibility' | 'coordination' | 'other';
  };

  const weddingTasks: TimelineTask[] = [
    { title: 'Confirm venue booking', description: 'Finalize and book the venue, pay deposit', daysBefore: 180, priority: 'critical', category: 'venue' },
    { title: 'Shortlist caterers', description: 'Research and shortlist 3-5 caterers for tasting', daysBefore: 150, priority: 'high', category: 'catering' },
    { title: 'Book photographer', description: 'Select and book wedding photographer and videographer', daysBefore: 120, priority: 'high', category: 'photography' },
    { title: 'Send save-the-dates', description: 'Design and send save-the-date cards', daysBefore: 120, priority: 'medium', category: 'invitations' },
    { title: 'Select wedding attire', description: 'Begin shopping for wedding attire and accessories', daysBefore: 90, priority: 'high', category: 'attire' },
    { title: 'Finalize catering menu', description: 'Attend tasting and finalize the menu', daysBefore: 60, priority: 'high', category: 'catering' },
    { title: 'Book entertainment', description: 'Book DJ, band, or other entertainment', daysBefore: 60, priority: 'medium', category: 'entertainment' },
    { title: 'Send invitations', description: 'Send formal wedding invitations', daysBefore: 45, priority: 'high', category: 'invitations' },
    { title: 'Plan decorations', description: 'Finalize decoration theme and hire decorator', daysBefore: 30, priority: 'medium', category: 'decoration' },
    { title: 'Arrange transportation', description: 'Book transportation for bridal party and guests', daysBefore: 14, priority: 'medium', category: 'transportation' },
    { title: 'Final guest count', description: 'Confirm final guest count with all vendors', daysBefore: 7, priority: 'critical', category: 'coordination' },
    { title: 'Final walkthrough', description: 'Visit the venue for final walkthrough and setup plan', daysBefore: 3, priority: 'critical', category: 'coordination' },
  ];

  const birthdayTasks: TimelineTask[] = [
    { title: 'Book venue or plan home setup', description: 'Secure the party location', daysBefore: 30, priority: 'high', category: 'venue' },
    { title: 'Create guest list', description: 'Finalize the guest list and send invitations', daysBefore: 21, priority: 'high', category: 'invitations' },
    { title: 'Order birthday cake', description: 'Design and order the cake from a bakery', daysBefore: 14, priority: 'high', category: 'catering' },
    { title: 'Plan activities and games', description: 'Organize activities, games, or entertainment', daysBefore: 14, priority: 'medium', category: 'entertainment' },
    { title: 'Buy decorations', description: 'Purchase party decorations, balloons, banners', daysBefore: 7, priority: 'medium', category: 'decoration' },
    { title: 'Arrange food and drinks', description: 'Finalize the menu and order food', daysBefore: 5, priority: 'high', category: 'catering' },
    { title: 'Confirm guest attendance', description: 'Follow up with guests who haven\'t responded', daysBefore: 3, priority: 'medium', category: 'coordination' },
    { title: 'Set up party space', description: 'Decorate and arrange the party space', daysBefore: 1, priority: 'critical', category: 'decoration' },
  ];

  const communityTasks: TimelineTask[] = [
    { title: 'Secure venue and permits', description: 'Book venue and obtain necessary permissions', daysBefore: 60, priority: 'critical', category: 'venue' },
    { title: 'Form organizing committee', description: 'Recruit volunteers and assign roles', daysBefore: 45, priority: 'high', category: 'coordination' },
    { title: 'Plan event program', description: 'Create the event schedule and activities', daysBefore: 30, priority: 'high', category: 'coordination' },
    { title: 'Promote the event', description: 'Create and distribute promotional materials', daysBefore: 21, priority: 'medium', category: 'invitations' },
    { title: 'Arrange equipment', description: 'Rent audio/visual and technical equipment', daysBefore: 14, priority: 'high', category: 'logistics' },
    { title: 'Confirm accessibility', description: 'Ensure venue is accessible and accommodations are in place', daysBefore: 10, priority: 'high', category: 'accessibility' },
    { title: 'Arrange catering', description: 'Finalize food and refreshment plans', daysBefore: 7, priority: 'medium', category: 'catering' },
    { title: 'Volunteer briefing', description: 'Brief all volunteers on their responsibilities', daysBefore: 2, priority: 'critical', category: 'coordination' },
    { title: 'Final setup', description: 'Complete venue setup and test equipment', daysBefore: 1, priority: 'critical', category: 'logistics' },
  ];

  const tasksMap: Record<string, TimelineTask[]> = {
    wedding: weddingTasks,
    engagement: weddingTasks,
    birthday: birthdayTasks,
    anniversary: birthdayTasks,
    community: communityTasks,
    'college-festival': communityTasks,
    meetup: communityTasks,
    'cultural-gathering': communityTasks,
    other: birthdayTasks,
  };

  const baseTasks = tasksMap[basicInfo.type] || birthdayTasks;

  // Adjust tasks based on available planning time
  return baseTasks
    .filter((task) => task.daysBefore <= Math.max(daysUntil, 1) || task.daysBefore <= 7)
    .map((task) => ({
      title: task.title,
      description: task.description,
      dueDate: clampDate(getDateBefore(eventDate, Math.min(task.daysBefore, Math.max(daysUntil - 1, 0))), today),
      priority: task.priority,
      category: task.category,
    }));
}

function generateVendorChecklist(basicInfo: EventBasicInfo) {
  type VendorItem = {
    category: 'venue' | 'caterer' | 'photographer' | 'decorator' | 'music-entertainment' | 'transportation' | 'equipment-rental' | 'cake-bakery' | 'invitations-printing' | 'security-logistics' | 'other';
    title: string;
    description: string;
    suggestedLeadTimeDays: number;
  };

  const weddingVendors: VendorItem[] = [
    { category: 'venue', title: 'Research wedding venues', description: 'Visit and compare at least 3 venues that fit your style and budget', suggestedLeadTimeDays: 180 },
    { category: 'caterer', title: 'Compare catering services', description: 'Get quotes from multiple caterers and arrange tastings', suggestedLeadTimeDays: 120 },
    { category: 'photographer', title: 'Book photographer', description: 'Review portfolios and book a wedding photographer', suggestedLeadTimeDays: 120 },
    { category: 'decorator', title: 'Hire decorator', description: 'Find a decorator who matches your theme', suggestedLeadTimeDays: 60 },
    { category: 'music-entertainment', title: 'Book entertainment', description: 'Arrange DJ, live band, or other entertainment', suggestedLeadTimeDays: 60 },
  ];

  const birthdayVendors: VendorItem[] = [
    { category: 'venue', title: 'Book party venue', description: 'Reserve party space or plan home party setup', suggestedLeadTimeDays: 30 },
    { category: 'cake-bakery', title: 'Order birthday cake', description: 'Find a bakery for a custom cake', suggestedLeadTimeDays: 14 },
    { category: 'caterer', title: 'Arrange food', description: 'Order catering or plan a home-cooked menu', suggestedLeadTimeDays: 7 },
    { category: 'decorator', title: 'Get decorations', description: 'Purchase or arrange party decorations', suggestedLeadTimeDays: 7 },
  ];

  const communityVendors: VendorItem[] = [
    { category: 'venue', title: 'Secure venue', description: 'Book venue and obtain required permits', suggestedLeadTimeDays: 60 },
    { category: 'equipment-rental', title: 'Arrange equipment', description: 'Rent audio/visual equipment, chairs, tables', suggestedLeadTimeDays: 14 },
    { category: 'caterer', title: 'Arrange refreshments', description: 'Plan food and beverages for attendees', suggestedLeadTimeDays: 7 },
    { category: 'security-logistics', title: 'Plan logistics', description: 'Coordinate setup, safety, and crowd management', suggestedLeadTimeDays: 7 },
  ];

  const vendorsMap: Record<string, VendorItem[]> = {
    wedding: weddingVendors,
    engagement: weddingVendors,
    birthday: birthdayVendors,
    anniversary: birthdayVendors,
    community: communityVendors,
    'college-festival': communityVendors,
    meetup: communityVendors,
    'cultural-gathering': communityVendors,
    other: birthdayVendors,
  };

  return vendorsMap[basicInfo.type] || birthdayVendors;
}

function generateIdeas(
  basicInfo: EventBasicInfo,
  budgetInfo: EventBudgetInfo,
  preferences: EventPreferences
) {
  const budget = budgetInfo.totalBudget;
  const perGuestBudget = Math.round(budget / basicInfo.guestCount);

  const weddingIdeas = [
    { title: 'Personalized welcome station', description: 'Set up a welcome area with a custom sign, signature drinks, and a photo display of the couple\'s journey.', estimatedCost: Math.round(budget * 0.02), category: 'guest-experience' },
    { title: 'Custom wedding favors', description: 'Create personalized favors that reflect the couple\'s story or cultural heritage.', estimatedCost: Math.round(perGuestBudget * 0.05 * basicInfo.guestCount), category: 'decoration' },
    { title: 'Interactive food stations', description: 'Set up live food stations where guests can customize their dishes.', estimatedCost: Math.round(budget * 0.05), category: 'catering' },
    { title: 'Photo booth with props', description: 'Create a themed photo booth with fun props and instant prints for guests.', estimatedCost: Math.round(budget * 0.02), category: 'entertainment' },
    { title: 'Memory wall', description: 'Display photos and messages from family and friends on a decorated memory wall.', estimatedCost: Math.round(budget * 0.01), category: 'decoration' },
  ];

  const birthdayIdeas = [
    { title: 'Custom photo timeline', description: 'Display a timeline of photos from birth to the current age.', estimatedCost: Math.round(budget * 0.03), category: 'decoration' },
    { title: 'DIY activity corner', description: 'Set up a creative station where guests can make art, crafts, or personalized gifts.', estimatedCost: Math.round(budget * 0.05), category: 'entertainment' },
    { title: 'Themed food display', description: 'Arrange food to match the party theme with creative presentation.', estimatedCost: Math.round(budget * 0.08), category: 'catering' },
    { title: 'Surprise guest appearance', description: 'Arrange for a special person or performer to make a surprise entrance.', estimatedCost: Math.round(budget * 0.05), category: 'entertainment' },
    { title: 'Custom playlist station', description: 'Let guests add songs to a collaborative playlist throughout the party.', estimatedCost: Math.round(budget * 0.01), category: 'entertainment' },
  ];

  const communityIdeas = [
    { title: 'Interactive workshops', description: 'Organize skill-sharing workshops led by community members.', estimatedCost: Math.round(budget * 0.05), category: 'entertainment' },
    { title: 'Community photo wall', description: 'Create a collaborative photo wall where attendees share stories and memories.', estimatedCost: Math.round(budget * 0.02), category: 'decoration' },
    { title: 'Local vendor marketplace', description: 'Invite local businesses to set up stalls showcasing their products.', estimatedCost: Math.round(budget * 0.03), category: 'coordination' },
    { title: 'Cultural performance area', description: 'Dedicate a stage for performances celebrating local culture and talent.', estimatedCost: Math.round(budget * 0.08), category: 'entertainment' },
    { title: 'Sustainability station', description: 'Set up recycling stations and encourage eco-friendly practices.', estimatedCost: Math.round(budget * 0.01), category: 'logistics' },
  ];

  const ideasMap: Record<string, typeof weddingIdeas> = {
    wedding: weddingIdeas,
    engagement: weddingIdeas,
    birthday: birthdayIdeas,
    anniversary: birthdayIdeas,
    community: communityIdeas,
    'college-festival': communityIdeas,
    meetup: communityIdeas,
    'cultural-gathering': communityIdeas,
    other: birthdayIdeas,
  };

  return ideasMap[basicInfo.type] || birthdayIdeas;
}

function generateContingencies(basicInfo: EventBasicInfo) {
  const common = [
    { risk: 'Last-minute vendor cancellation', mitigation: 'Maintain a list of backup vendors for critical services. Have contact details ready.' },
    { risk: 'Budget overrun', mitigation: 'Track expenses regularly and maintain a contingency fund of 5-10% of total budget.' },
  ];

  if (basicInfo.venueType === 'outdoor' || basicInfo.venueType === 'mixed') {
    common.push({
      risk: 'Unfavorable weather conditions',
      mitigation: 'Arrange an indoor backup venue or rent waterproof tents and coverings.',
    });
  }

  if (basicInfo.guestCount > 100) {
    common.push({
      risk: 'Crowd management challenges',
      mitigation: 'Hire professional event coordinators and ensure clear signage and flow management.',
    });
  }

  common.push({
    risk: 'Technical equipment failure',
    mitigation: 'Test all audio/visual equipment beforehand and keep backup batteries and extension cords.',
  });

  return common;
}

export function generateDemoIdeas(
  basicInfo: EventBasicInfo,
  budgetInfo: EventBudgetInfo,
  preferences: EventPreferences,
  userPrompt: string
) {
  const budget = budgetInfo.totalBudget;
  const lowBudget = userPrompt.toLowerCase().includes('low-budget') || userPrompt.toLowerCase().includes('cheap');

  const ideas = [
    {
      title: 'DIY decorations workshop',
      description: `Create beautiful decorations with affordable materials. Perfect for a ${EVENT_TYPE_LABELS[basicInfo.type]?.toLowerCase() || 'event'} on a budget.`,
      estimatedCost: Math.round(budget * (lowBudget ? 0.01 : 0.03)),
      category: 'decoration',
    },
    {
      title: 'Community potluck style',
      description: 'Invite guests to bring their signature dish, creating a diverse and memorable food experience.',
      estimatedCost: Math.round(budget * 0.02),
      category: 'catering',
    },
    {
      title: 'Digital invitation suite',
      description: 'Use beautifully designed digital invitations instead of printed ones - eco-friendly and cost-effective.',
      estimatedCost: Math.round(budget * 0.005),
      category: 'invitations',
    },
    {
      title: 'Personalized music playlist',
      description: 'Curate a Spotify or YouTube playlist with songs meaningful to the event instead of hiring a DJ.',
      estimatedCost: 0,
      category: 'entertainment',
    },
    {
      title: 'Photo corner with props',
      description: 'Set up a decorated photo corner with fun props - much cheaper than a full photo booth.',
      estimatedCost: Math.round(budget * 0.02),
      category: 'entertainment',
    },
  ];

  return ideas;
}
