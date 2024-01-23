import { Pool } from 'pg';

const postgres = process.env.postgresconn as string;
const pool = new Pool({
	connectionString: postgres
});

export const query = async (text: string, params?: any[]) => {
 try {
  const result = await pool.query(text, params);
  return result.rows;
 } catch (error) {
  console.error('Database query error:', error);
  throw error;
 }
};

// create the tfobserver table if it doesn't exist
export const initDB = async () => {
 await query(`
   CREATE TABLE IF NOT EXISTS tfobserver (
     channelid TEXT PRIMARY KEY,
     latestversion TEXT NOT NULL
   )
 `);
};

// load settings from the tfobserver table
export const loadSettings = async () => {
 try {
  const result = await query('SELECT * FROM tfobserver LIMIT 1');
  if (result.length > 0) {
   return { channelId: result[0].channelid, latestVersion: result[0].latestversion };
  }
  return { channelId: process.env.CHANNEL_ID ?? "", latestVersion: '0.0' };
 } catch (error) {
  console.error('Error loading settings:', error);
  return { channelId: process.env.CHANNEL_ID ?? "", latestVersion: '0.0' };
 }
};

// save settings to tfobserver table
export const saveSettings = async (channelId: string, latestVersion: string) => {
 try {
  await query(`
     INSERT INTO tfobserver (channelid, latestversion) VALUES ($1, $2)
     ON CONFLICT (channelid) DO UPDATE SET latestversion = EXCLUDED.latestversion
   `, [channelId, latestVersion]);
 } catch (error) {
  console.error('Error saving settings:', error);
 }
};

// only the channelId in the tfobserver table
export const saveChannelId = async (channelId: string) => {
 try {
  await query('UPDATE tfobserver SET channelid = $1', [channelId]);
 } catch (error) {
  console.error('Error saving channelId:', error);
 }
};