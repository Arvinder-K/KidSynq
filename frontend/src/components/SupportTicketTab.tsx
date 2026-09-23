import React, { useState, useEffect } from 'react';
import api from '../api';
import { LifeBuoy, Search, MessageCircle, Send, X } from 'lucide-react';

interface SupportTicketMessage {
  id: string;
  sender: number;
  message: string;
  created_at: string;
}

interface SupportTicket {
  id: string;
  ticket_number: string;
  daycare: number;
  created_by: number;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  messages: SupportTicketMessage[];
  created_at: string;
  updated_at: string;
}

const SupportTicketTab: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  
  // Message Reply State
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await api.get('http://localhost:8000/api/super-admin/support-tickets/');
      setTickets(response.data.results || response.data);
      
      // Update selected ticket if it exists
      if (selectedTicket) {
        const updated = (response.data.results || response.data).find((t: SupportTicket) => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await api.patch(`http://localhost:8000/api/super-admin/support-tickets/${id}/`, { status: newStatus });
      fetchTickets();
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const handlePriorityChange = async (id: string, newPriority: string) => {
    try {
      await api.patch(`http://localhost:8000/api/super-admin/support-tickets/${id}/`, { priority: newPriority });
      fetchTickets();
    } catch (error) {
      console.error('Error updating ticket priority:', error);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    
    try {
      await api.post(`http://localhost:8000/api/super-admin/support-tickets/${selectedTicket.id}/messages/`, 
        { message: replyText }
      );
      setReplyText('');
      fetchTickets(); // Will refresh and update selectedTicket
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter ? ticket.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'in_progress': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'waiting': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-4">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Support Tickets</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and resolve daycare support requests.</p>
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
        {/* Ticket List (Left Sidebar) */}
        <div className={`w-full ${selectedTicket ? 'hidden lg:flex lg:w-1/3' : 'flex'} flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden`}>
          {/* Filters */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Search ticket # or subject..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            </div>
            
            <div className="flex gap-2">
              <select
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm rounded-lg focus:ring-indigo-500 p-2"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting">Waiting on Customer</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          
          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <LifeBuoy size={32} className="mx-auto mb-2 text-gray-300" />
                <p>No tickets found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredTickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-750 ${selectedTicket?.id === ticket.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-mono text-gray-500">{ticket.ticket_number}</span>
                      <span className="text-xs text-gray-400">{new Date(ticket.created_at).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1 mb-2">{ticket.subject}</h4>
                    <div className="flex gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ticket Details (Right Pane) */}
        {selectedTicket ? (
          <div className="w-full lg:w-2/3 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden h-full">
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <button className="lg:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700" onClick={() => setSelectedTicket(null)}>
                    <X size={20} />
                  </button>
                  <span className="text-sm font-mono font-medium text-indigo-600 dark:text-indigo-400">{selectedTicket.ticket_number}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{selectedTicket.subject}</h3>
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <select
                  className={`text-sm rounded-lg font-medium border-0 focus:ring-2 focus:ring-indigo-500 py-2 pl-3 pr-8 ${getStatusColor(selectedTicket.status)}`}
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting">Waiting on Customer</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                
                <select
                  className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm rounded-lg focus:ring-indigo-500 text-gray-700 dark:text-gray-200 py-2 pl-3 pr-8"
                  value={selectedTicket.priority}
                  onChange={(e) => handlePriorityChange(selectedTicket.id, e.target.value)}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            
            {/* Thread (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 min-h-0 bg-white dark:bg-gray-800">
              {/* Original Post */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  CU
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-gray-900 dark:text-white">Customer (Daycare Admin)</span>
                    <span className="text-xs text-gray-500">{new Date(selectedTicket.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-gray-700 dark:text-gray-300 text-sm bg-gray-50 dark:bg-gray-700/50 p-4 rounded-b-xl rounded-tr-xl whitespace-pre-wrap border border-gray-100 dark:border-gray-700">
                    {selectedTicket.description}
                  </div>
                </div>
              </div>
              
              {/* Messages */}
              {selectedTicket.messages?.map(msg => {
                const isSystemReply = msg.sender !== selectedTicket.created_by;
                return (
                  <div key={msg.id} className={`flex gap-4 ${isSystemReply ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${isSystemReply ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
                      {isSystemReply ? 'SA' : 'CU'}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className={`flex items-baseline ${isSystemReply ? 'justify-end' : 'justify-between'}`}>
                        {isSystemReply ? (
                          <>
                            <span className="text-xs text-gray-500 mr-2">{new Date(msg.created_at).toLocaleString()}</span>
                            <span className="font-semibold text-gray-900 dark:text-white">Support Team (You)</span>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-gray-900 dark:text-white">Customer</span>
                            <span className="text-xs text-gray-500">{new Date(msg.created_at).toLocaleString()}</span>
                          </>
                        )}
                      </div>
                      <div className={`text-sm p-4 whitespace-pre-wrap shadow-sm ${
                        isSystemReply 
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-gray-800 dark:text-gray-200 rounded-b-xl rounded-tl-xl border border-indigo-100 dark:border-indigo-800/30' 
                          : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded-b-xl rounded-tr-xl border border-gray-100 dark:border-gray-700'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Reply Box */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
              {selectedTicket.status === 'closed' ? (
                <div className="text-center p-3 text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
                  This ticket is closed. You cannot send replies to a closed ticket.
                </div>
              ) : (
                <form onSubmit={handleReplySubmit} className="relative flex items-end gap-2">
                  <textarea
                    rows={3}
                    placeholder="Type your reply to the customer..."
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none text-sm"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  ></textarea>
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow-sm mb-0.5 flex-shrink-0"
                  >
                    <Send size={20} />
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex w-2/3 flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 border-dashed text-gray-500">
            <MessageCircle size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Ticket Selected</h3>
            <p>Select a ticket from the list to view details and reply.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportTicketTab;
