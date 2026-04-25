const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase credentials not found. Running in demo mode.');
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// In-memory store for demo mode
const demoStore = {
  issues: [],
  admins: [],
  citizens: []
};

// 6-day deadline in milliseconds
const DEADLINE_MS = 6 * 24 * 60 * 60 * 1000;

const db = {
  // Issues
  async createIssue(issue) {
    const deadline_at = new Date(Date.now() + DEADLINE_MS).toISOString();
    if (supabase) {
      const { data, error } = await supabase.from('issues').insert({ ...issue, deadline_at }).select().single();
      if (error) throw error;
      return data;
    }
    const newIssue = {
      id: crypto.randomUUID(),
      ...issue,
      deadline_at,
      resolved_photo_url: null,
      citizen_reaction: null,
      created_at: issue.created_at || new Date().toISOString(),
      updated_at: issue.updated_at || new Date().toISOString()
    };
    demoStore.issues.push(newIssue);
    return newIssue;
  },

  async getIssueByTicketId(ticketId) {
    if (supabase) {
      const { data, error } = await supabase.from('issues').select('*').eq('ticket_id', ticketId).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    }
    return demoStore.issues.find(i => i.ticket_id === ticketId) || null;
  },

  async getIssues(filters = {}) {
    if (supabase) {
      let query = supabase.from('issues').select('*').order('created_at', { ascending: false });
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.category) query = query.eq('category', filters.category);
      if (filters.city) query = query.eq('city', filters.city);
      if (filters.ward) query = query.eq('ward', filters.ward);
      if (filters.from_date) query = query.gte('created_at', filters.from_date);
      if (filters.to_date) query = query.lte('created_at', filters.to_date);
      if (filters.limit) query = query.limit(filters.limit);
      if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
    let results = [...demoStore.issues];
    if (filters.status) results = results.filter(i => i.status === filters.status);
    if (filters.category) results = results.filter(i => i.category === filters.category);
    if (filters.city) results = results.filter(i => i.city === filters.city);
    if (filters.ward) results = results.filter(i => i.ward === filters.ward);
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return results;
  },

  async getIssuesByCitizen(citizenId) {
    if (supabase) {
      const { data, error } = await supabase.from('issues').select('*').eq('citizen_id', citizenId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    return demoStore.issues
      .filter(i => i.citizen_id === citizenId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async updateIssue(id, updates) {
    updates.updated_at = new Date().toISOString();
    if (updates.status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }
    if (supabase) {
      const { data, error } = await supabase.from('issues').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
    const idx = demoStore.issues.findIndex(i => i.id === id);
    if (idx === -1) return null;
    demoStore.issues[idx] = { ...demoStore.issues[idx], ...updates };
    return demoStore.issues[idx];
  },

  // Get overdue issues (past deadline, not resolved/invalid)
  async getOverdueIssues() {
    const now = new Date().toISOString();
    if (supabase) {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .lt('deadline_at', now)
        .not('status', 'in', '("resolved","invalid")')
        .eq('deadline_alert_sent', false);
      if (error) throw error;
      return data || [];
    }
    return demoStore.issues.filter(i =>
      i.deadline_at && new Date(i.deadline_at) < new Date() &&
      !['resolved', 'invalid'].includes(i.status) &&
      !i.deadline_alert_sent
    );
  },

  async markDeadlineAlertSent(id) {
    return this.updateIssue(id, { deadline_alert_sent: true });
  },

  async getAnalytics(city = null) {
    const issues = await this.getIssues(city ? { city } : {});
    const total = issues.length;
    const resolved = issues.filter(i => i.status === 'resolved').length;
    const pending = issues.filter(i => i.status === 'pending').length;
    const inProgress = issues.filter(i => i.status === 'in_progress' || i.status === 'assigned').length;

    const resolvedIssues = issues.filter(i => i.resolved_at);
    const avgResolutionDays = resolvedIssues.length > 0
      ? resolvedIssues.reduce((sum, i) => {
          const diff = new Date(i.resolved_at) - new Date(i.created_at);
          return sum + diff / (1000 * 60 * 60 * 24);
        }, 0) / resolvedIssues.length
      : 0;

    const categories = {};
    issues.forEach(i => { categories[i.category] = (categories[i.category] || 0) + 1; });

    const cities = {};
    issues.forEach(i => {
      if (!cities[i.city]) cities[i.city] = { total: 0, resolved: 0, pending: 0 };
      cities[i.city].total++;
      if (i.status === 'resolved') cities[i.city].resolved++;
      if (i.status === 'pending') cities[i.city].pending++;
    });

    const civicHealth = Object.entries(cities).map(([city, data]) => ({
      city,
      total: data.total,
      resolved: data.resolved,
      score: data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0
    }));

    return {
      total, resolved, pending,
      in_progress: inProgress,
      avg_resolution_days: Math.round(avgResolutionDays * 10) / 10,
      categories,
      civic_health: civicHealth
    };
  },

  // Admins
  async getAdminByEmail(email) {
    if (supabase) {
      const { data, error } = await supabase.from('admins').select('*').eq('email', email).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
    return demoStore.admins.find(a => a.email === email) || null;
  },

  async getAdminsByCity(city, category = null) {
    if (supabase) {
      let query = supabase.from('admins').select('*').eq('city', city).neq('role', 'super_admin');
      if (category) query = query.eq('category', category);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
    return demoStore.admins.filter(a =>
      a.city === city && a.role !== 'super_admin' &&
      (!category || a.category === category)
    );
  },

  // Citizens
  async createCitizen(citizen) {
    if (supabase) {
      const { data, error } = await supabase.from('citizens').insert(citizen).select().single();
      if (error) throw error;
      return data;
    }
    const newCitizen = { id: crypto.randomUUID(), ...citizen, created_at: new Date().toISOString() };
    demoStore.citizens.push(newCitizen);
    return newCitizen;
  },

  async getCitizenByEmail(email) {
    if (supabase) {
      const { data, error } = await supabase.from('citizens').select('*').eq('email', email).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
    return demoStore.citizens.find(c => c.email === email) || null;
  },

  async getCitizenById(id) {
    if (supabase) {
      const { data, error } = await supabase.from('citizens').select('*').eq('id', id).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
    return demoStore.citizens.find(c => c.id === id) || null;
  },

  // Super admins — used for dispute escalation emails
  async getSuperAdmins() {
    if (supabase) {
      const { data, error } = await supabase.from('admins').select('*').eq('role', 'super_admin');
      if (error) throw error;
      return data || [];
    }
    return demoStore.admins.filter(a => a.role === 'super_admin');
  },

  // Seed helpers
  async seedIssue(issue) { return this.createIssue(issue); },
  async seedAdmin(admin) {
    if (supabase) {
      const { data, error } = await supabase.from('admins').upsert(admin, { onConflict: 'email' }).select().single();
      if (error) throw error;
      return data;
    }
    const existing = demoStore.admins.findIndex(a => a.email === admin.email);
    if (existing >= 0) {
      demoStore.admins[existing] = { ...demoStore.admins[existing], ...admin };
      return demoStore.admins[existing];
    }
    const newAdmin = { id: crypto.randomUUID(), ...admin };
    demoStore.admins.push(newAdmin);
    return newAdmin;
  }
};

module.exports = { supabase, db, demoStore };
