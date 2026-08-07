import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';

interface MealRecord { id: string; meal_type: string; food_provided: string; amount_eaten: string; recorded_at: string; }
interface NapRecord { id: string; start_time: string; end_time: string; quality: string; recorded_at: string; }
interface ActivityRecord { id: string; activity_type: string; description: string; recorded_at: string; }

interface DailyReport {
    id: string;
    report_date: string;
    meals: MealRecord[];
    naps: NapRecord[];
    activities: ActivityRecord[];
}

interface Student {
    id: string;
    first_name: string;
    last_name: string;
}

const DailyActivities: React.FC = () => {
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<string>('');
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [report, setReport] = useState<DailyReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'meal' | 'nap' | 'activity'>('meal');
    const [formLoading, setFormLoading] = useState(false);

    // Fetch students on mount
    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const res = await api.get('/students/');
                setStudents(res.data);
            } catch (error) {
                console.error("Failed to fetch students", error);
            }
        };
        fetchStudents();
    }, []);

    const fetchReport = async (studentId: string, dateStr: string) => {
        if (!studentId) {
            setReport(null);
            return;
        }
        setLoading(true);
        try {
            const res = await api.get('/activities/report/', { params: { student_id: studentId, date: dateStr } });
            setReport(res.data);
        } catch (error) {
            console.error("Failed to fetch daily report", error);
            setReport(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport(selectedStudent, currentDate);
    }, [selectedStudent, currentDate]);

    const handleLogActivity = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!report) return;
        setFormLoading(true);
        const formData = new FormData(e.currentTarget);
        const payload: any = {
            report_id: report.id,
            type: activeTab,
        };
        
        if (activeTab === 'meal') {
            payload.meal_type = formData.get('meal_type');
            payload.food_provided = formData.get('food_provided');
            payload.amount_eaten = formData.get('amount_eaten');
        } else if (activeTab === 'nap') {
            payload.start_time = formData.get('start_time');
            payload.end_time = formData.get('end_time') || null;
            payload.quality = formData.get('quality');
        } else if (activeTab === 'activity') {
            payload.activity_type = formData.get('activity_type');
            payload.description = formData.get('description');
        }

        try {
            await api.post('/activities/log/', payload);
            (e.target as HTMLFormElement).reset();
            // Refresh report to show new activity
            await fetchReport(selectedStudent, currentDate);
        } catch (error) {
            console.error("Failed to log activity", error);
        } finally {
            setFormLoading(false);
        }
    };

    return (
        <Layout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Daily Activities</h1>
                    <p className="mt-1 text-sm text-gray-500">Record meals, naps, and play for individual students.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex items-center">
                        <label className="mr-3 text-sm font-medium text-gray-700">Date:</label>
                        <input 
                            type="date" 
                            value={currentDate} 
                            onChange={(e) => setCurrentDate(e.target.value)}
                            className="border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm" 
                        />
                    </div>
                    <div className="flex items-center">
                        <label className="mr-3 text-sm font-medium text-gray-700">Student:</label>
                        <select 
                            value={selectedStudent} 
                            onChange={(e) => setSelectedStudent(e.target.value)}
                            className="border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm min-w-[200px]"
                        >
                            <option value="">-- Select a Student --</option>
                            {students.map(s => (
                                <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {!selectedStudent ? (
                <div className="bg-white shadow sm:rounded-lg py-16 text-center text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="mt-4">Please select a student to view or log activities.</p>
                </div>
            ) : loading ? (
                <div className="text-center py-12 text-gray-500">Loading daily report...</div>
            ) : report ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Timeline */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
                            <h2 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Today's Timeline</h2>
                            
                            {report.meals.length === 0 && report.naps.length === 0 && report.activities.length === 0 ? (
                                <p className="text-gray-500 italic text-sm">No activities logged yet for this date.</p>
                            ) : (
                                <div className="space-y-4">
                                    {/* Meals */}
                                    {report.meals.map(m => (
                                        <div key={m.id} className="flex gap-4 items-start p-3 bg-orange-50 rounded-md border border-orange-100">
                                            <div className="bg-orange-100 p-2 rounded-full text-orange-600">🍔</div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{m.meal_type} <span className="text-xs font-normal text-gray-500 ml-2">{new Date(m.recorded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></p>
                                                <p className="text-sm text-gray-700 mt-1">{m.food_provided}</p>
                                                <p className="text-xs text-orange-700 mt-1 font-medium">Ate: {m.amount_eaten}</p>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Naps */}
                                    {report.naps.map(n => (
                                        <div key={n.id} className="flex gap-4 items-start p-3 bg-indigo-50 rounded-md border border-indigo-100">
                                            <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">💤</div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">Nap Time <span className="text-xs font-normal text-gray-500 ml-2">{new Date(n.recorded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></p>
                                                <p className="text-sm text-gray-700 mt-1">{n.start_time.substring(0,5)} - {n.end_time ? n.end_time.substring(0,5) : 'Ongoing'}</p>
                                                <p className="text-xs text-indigo-700 mt-1 font-medium">Quality: {n.quality}</p>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Activities */}
                                    {report.activities.map(a => (
                                        <div key={a.id} className="flex gap-4 items-start p-3 bg-green-50 rounded-md border border-green-100">
                                            <div className="bg-green-100 p-2 rounded-full text-green-600">🎨</div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{a.activity_type} <span className="text-xs font-normal text-gray-500 ml-2">{new Date(a.recorded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></p>
                                                <p className="text-sm text-gray-700 mt-1">{a.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Logging Form */}
                    <div className="lg:col-span-1">
                        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                <h3 className="text-sm font-medium text-gray-900">Log New Activity</h3>
                            </div>
                            
                            {/* Form Tabs */}
                            <div className="flex border-b border-gray-200">
                                <button onClick={() => setActiveTab('meal')} className={`flex-1 py-2 text-xs font-medium text-center ${activeTab === 'meal' ? 'bg-white border-b-2 border-indigo-500 text-indigo-600' : 'bg-gray-50 text-gray-500 hover:text-gray-700'}`}>Meal</button>
                                <button onClick={() => setActiveTab('nap')} className={`flex-1 py-2 text-xs font-medium text-center ${activeTab === 'nap' ? 'bg-white border-b-2 border-indigo-500 text-indigo-600' : 'bg-gray-50 text-gray-500 hover:text-gray-700'}`}>Nap</button>
                                <button onClick={() => setActiveTab('activity')} className={`flex-1 py-2 text-xs font-medium text-center ${activeTab === 'activity' ? 'bg-white border-b-2 border-indigo-500 text-indigo-600' : 'bg-gray-50 text-gray-500 hover:text-gray-700'}`}>Activity</button>
                            </div>

                            <form onSubmit={handleLogActivity} className="p-4 space-y-4">
                                {activeTab === 'meal' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Meal Type</label>
                                            <select name="meal_type" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                                <option value="Breakfast">Breakfast</option>
                                                <option value="AM Snack">AM Snack</option>
                                                <option value="Lunch">Lunch</option>
                                                <option value="PM Snack">PM Snack</option>
                                                <option value="Dinner">Dinner</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Food Provided</label>
                                            <input type="text" name="food_provided" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Amount Eaten</label>
                                            <select name="amount_eaten" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                                <option value="All">All</option>
                                                <option value="Most">Most</option>
                                                <option value="Some">Some</option>
                                                <option value="None">None</option>
                                            </select>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'nap' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Start Time</label>
                                                <input type="time" name="start_time" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">End Time</label>
                                                <input type="time" name="end_time" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Quality</label>
                                            <select name="quality" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                                <option value="Slept Well">Slept Well</option>
                                                <option value="Restless">Restless</option>
                                                <option value="Did Not Sleep">Did Not Sleep</option>
                                            </select>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'activity' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Activity Type</label>
                                            <select name="activity_type" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                                <option value="Outdoor Play">Outdoor Play</option>
                                                <option value="Art & Crafts">Art & Crafts</option>
                                                <option value="Reading/Storytime">Reading/Storytime</option>
                                                <option value="Sensory Play">Sensory Play</option>
                                                <option value="Music & Movement">Music & Movement</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Description</label>
                                            <textarea name="description" required rows={3} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <button 
                                        type="submit" 
                                        disabled={formLoading}
                                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
                                    >
                                        {formLoading ? 'Saving...' : 'Save Record'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            ) : null}
        </Layout>
    );
};

export default DailyActivities;
