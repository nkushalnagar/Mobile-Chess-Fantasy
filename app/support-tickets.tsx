import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface SupportTicket {
  id: string;
  user_id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  comment: string;
  is_admin: boolean;
  created_at: string;
  username: string;
}

type PriorityType = 'high' | 'medium' | 'low';

export default function SupportTicketsScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { colors } = useTheme();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  
  // Create ticket form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<PriorityType>('medium');
  const [submitting, setSubmitting] = useState(false);

  // New comment
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Delete account
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTickets();
    }
  }, [user]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      Alert.alert('Error', 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_ticket_comments')
        .select(`
          *,
          profiles!support_ticket_comments_user_id_fkey(username)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const commentsWithUsernames = (data || []).map(comment => ({
        ...comment,
        username: comment.profiles?.username || 'Unknown'
      }));

      setComments(commentsWithUsernames);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const createTicket = async () => {
    if (!newTitle.trim() || !newDescription.trim() || !user) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          title: newTitle.trim(),
          description: newDescription.trim(),
          priority: newPriority,
          status: 'open'
        });

      if (error) throw error;

      Alert.alert('Success', 'Your ticket has been submitted. We\'ll get back to you soon!');
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setCreateModalVisible(false);
      fetchTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      Alert.alert('Error', 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedTicket || !user) return;

    try {
      setAddingComment(true);
      const { error } = await supabase
        .from('support_ticket_comments')
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          comment: newComment.trim(),
          is_admin: false
        });

      if (error) throw error;

      setNewComment('');
      fetchComments(selectedTicket.id);
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  const openTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    fetchComments(ticket.id);
    setViewModalVisible(true);
  };

  const handleDeleteAccount = async () => {
    if (!deleteReason.trim()) {
      Alert.alert('Required', 'Please tell us why you want to delete your account.');
      return;
    }

    if (deleteConfirmation.toLowerCase() !== 'delete') {
      Alert.alert('Confirmation Required', 'Please type "delete" to confirm account deletion.');
      return;
    }

    if (!user?.id) return;

    setDeleting(true);

    try {
      const { error } = await supabase.rpc('delete_user_account', {
        p_user_id: user.id,
        p_reason: deleteReason.trim()
      });

      if (error) throw error;

      Alert.alert(
        'Account Deleted',
        'Your account has been permanently deleted.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/');
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
    } finally {
      setDeleting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#64748b';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Urgent';
      case 'medium': return 'Medium';
      case 'low': return 'Low Priority';
      default: return priority;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity 
            onPress={() => setCreateModalVisible(true)}
            style={[styles.createButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.createButtonText}>+ New Ticket</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {tickets.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: colors.text }]}>No support tickets yet</Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                Tap "New Ticket" to get help with any issues
              </Text>
            </View>
          ) : (
            tickets.map((ticket) => (
              <TouchableOpacity
                key={ticket.id}
                style={[styles.ticketCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => openTicket(ticket)}
              >
                <View style={styles.ticketHeader}>
                  <Text style={[styles.ticketTitle, { color: colors.text }]}>{ticket.title}</Text>
                  <View style={[styles.statusBadge, { 
                    backgroundColor: ticket.status === 'open' ? '#10b98120' : '#64748b20' 
                  }]}>
                    <Text style={[styles.statusText, {
                      color: ticket.status === 'open' ? '#10b981' : '#64748b'
                    }]}>
                      {ticket.status === 'open' ? 'Open' : 'Closed'}
                    </Text>
                  </View>
                </View>
                
                <Text style={[styles.ticketDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                  {ticket.description}
                </Text>

                <View style={styles.ticketFooter}>
                  <View style={[styles.priorityBadge, { 
                    backgroundColor: getPriorityColor(ticket.priority) + '20' 
                  }]}>
                    <Text style={[styles.priorityText, { 
                      color: getPriorityColor(ticket.priority) 
                    }]}>
                      {getPriorityLabel(ticket.priority)}
                    </Text>
                  </View>
                  <Text style={[styles.ticketDate, { color: colors.textSecondary }]}>{formatDate(ticket.created_at)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Delete Account Section */}
          <View style={styles.deleteAccountSection}>
            <Text style={[styles.deleteAccountTitle, { color: colors.textSecondary }]}>Danger Zone</Text>
            <TouchableOpacity 
              style={[styles.deleteAccountButton, { borderColor: colors.error }]} 
              onPress={() => setDeleteModalVisible(true)}
            >
              <Text style={[styles.deleteAccountButtonText, { color: colors.error }]}>Delete Account</Text>
            </TouchableOpacity>
            <Text style={[styles.deleteAccountWarning, { color: colors.textTertiary }]}>
              This action cannot be undone. All your data will be permanently deleted.
            </Text>
          </View>
        </ScrollView>

        {/* Create Ticket Modal */}
        <Modal
          visible={createModalVisible}
          animationType="slide"
          onRequestClose={() => setCreateModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalContainer, { backgroundColor: colors.background }]}
          >
            <View style={[styles.modalHeader, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create Support Ticket</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={[styles.label, { color: colors.text }]}>Title</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Brief description of your issue"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={[styles.label, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Provide details about your issue..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={6}
              />

              <Text style={[styles.label, { color: colors.text }]}>Priority</Text>
              <View style={styles.prioritySelector}>
                {(['high', 'medium', 'low'] as PriorityType[]).map((priority) => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.priorityOption,
                      newPriority === priority && styles.priorityOptionSelected,
                      newPriority === priority 
                        ? { borderColor: getPriorityColor(priority), backgroundColor: getPriorityColor(priority) + '15' }
                        : { borderColor: colors.border, backgroundColor: colors.cardBackground }
                    ]}
                    onPress={() => setNewPriority(priority)}
                  >
                    <Text style={[
                      styles.priorityOptionText,
                      { color: colors.textSecondary },
                      newPriority === priority && { color: getPriorityColor(priority), fontWeight: 'bold' }
                    ]}>
                      {getPriorityLabel(priority)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, (!newTitle.trim() || !newDescription.trim() || submitting) && styles.submitButtonDisabled]}
                onPress={createTicket}
                disabled={!newTitle.trim() || !newDescription.trim() || submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        {/* View Ticket Modal */}
        <Modal
          visible={viewModalVisible}
          animationType="slide"
          onRequestClose={() => setViewModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalContainer, { backgroundColor: colors.background }]}
          >
            <View style={[styles.modalHeader, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Ticket Details</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedTicket && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.ticketDetailHeader}>
                  <Text style={[styles.ticketDetailTitle, { color: colors.text }]}>{selectedTicket.title}</Text>
                  <View style={styles.ticketDetailBadges}>
                    <View style={[styles.statusBadge, { 
                      backgroundColor: selectedTicket.status === 'open' ? '#10b98120' : '#64748b20' 
                    }]}>
                      <Text style={[styles.statusText, {
                        color: selectedTicket.status === 'open' ? '#10b981' : '#64748b'
                      }]}>
                        {selectedTicket.status === 'open' ? 'Open' : 'Closed'}
                      </Text>
                    </View>
                    <View style={[styles.priorityBadge, { 
                      backgroundColor: getPriorityColor(selectedTicket.priority) + '20' 
                    }]}>
                      <Text style={[styles.priorityText, { 
                        color: getPriorityColor(selectedTicket.priority) 
                      }]}>
                        {getPriorityLabel(selectedTicket.priority)}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={[styles.ticketDetailDescription, { color: colors.textSecondary }]}>{selectedTicket.description}</Text>
                <Text style={[styles.ticketDetailDate, { color: colors.textTertiary }]}>
                  Created {formatDate(selectedTicket.created_at)}
                </Text>

                {/* Comments Section */}
                <View style={styles.commentsSection}>
                  <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments</Text>
                  {comments.length === 0 ? (
                    <Text style={[styles.noComments, { color: colors.textSecondary }]}>No comments yet</Text>
                  ) : (
                    comments.map((comment) => (
                      <View key={comment.id} style={[styles.commentCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <View style={styles.commentHeader}>
                          <Text style={[
                            styles.commentUsername,
                            { color: colors.primary },
                            comment.is_admin && styles.adminUsername
                          ]}>
                            {comment.is_admin ? '👑 Support Team' : `@${comment.username}`}
                          </Text>
                          <Text style={[styles.commentDate, { color: colors.textTertiary }]}>{formatDate(comment.created_at)}</Text>
                        </View>
                        <Text style={[styles.commentText, { color: colors.textSecondary }]}>{comment.comment}</Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Add Comment (only if ticket is open) */}
                {selectedTicket.status === 'open' && (
                  <View style={styles.addCommentSection}>
                    <TextInput
                      style={[styles.commentInput, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
                      value={newComment}
                      onChangeText={setNewComment}
                      placeholder="Add a comment..."
                      placeholderTextColor={colors.textTertiary}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.addCommentButton, (!newComment.trim() || addingComment) && styles.addCommentButtonDisabled]}
                      onPress={addComment}
                      disabled={!newComment.trim() || addingComment}
                    >
                      <Text style={styles.addCommentButtonText}>
                        {addingComment ? 'Sending...' : 'Send'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </Modal>

        {/* Delete Account Modal */}
        <Modal
          visible={deleteModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setDeleteModalVisible(false)}
        >
          <View style={styles.deleteModalOverlay}>
            <View style={[styles.deleteModalContent, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.deleteModalTitle, { color: colors.text }]}>Delete Account</Text>
              <Text style={[styles.deleteModalDescription, { color: colors.textSecondary }]}>
                This action cannot be undone. All your data will be permanently deleted.
              </Text>

              <Text style={[styles.deleteInputLabel, { color: colors.text }]}>Why are you deleting your account?</Text>
              <TextInput
                style={[styles.deleteTextInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Please tell us your reason..."
                placeholderTextColor={colors.textTertiary}
                value={deleteReason}
                onChangeText={setDeleteReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={[styles.deleteInputLabel, { color: colors.text }]}>Type "delete" to confirm</Text>
              <TextInput
                style={[styles.deleteTextInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="delete"
                placeholderTextColor={colors.textTertiary}
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
                autoCapitalize="none"
              />

              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteCancelButton, { backgroundColor: colors.background }]}
                  onPress={() => {
                    setDeleteModalVisible(false);
                    setDeleteReason('');
                    setDeleteConfirmation('');
                  }}
                  disabled={deleting}
                >
                  <Text style={[styles.deleteModalButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteConfirmButton, { backgroundColor: colors.error, opacity: deleting ? 0.5 : 1 }]}
                  onPress={handleDeleteAccount}
                  disabled={deleting}
                >
                  <Text style={[styles.deleteModalButtonText, { color: '#fff' }]}>
                    {deleting ? 'Deleting...' : 'Delete Account'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#93c5fd',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  createButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  ticketCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ticketDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 20,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ticketDate: {
    fontSize: 12,
    color: '#64748b',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  closeButton: {
    fontSize: 24,
    color: '#94a3b8',
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  priorityOptionSelected: {
    borderWidth: 2,
  },
  priorityOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  ticketDetailHeader: {
    marginBottom: 16,
  },
  ticketDetailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  ticketDetailBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  ticketDetailDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  ticketDetailDate: {
    fontSize: 12,
    marginBottom: 24,
  },
  commentsSection: {
    marginTop: 24,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  noComments: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
  },
  adminUsername: {
    color: '#fbbf24',
  },
  commentDate: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  addCommentSection: {
    marginTop: 16,
    marginBottom: 40,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  addCommentButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addCommentButtonDisabled: {
    opacity: 0.5,
  },
  addCommentButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteAccountSection: {
    marginTop: 40,
    marginBottom: 60,
    paddingTop: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  deleteAccountTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  deleteAccountButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  deleteAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccountWarning: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  deleteModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  deleteModalDescription: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  deleteInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  deleteTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  deleteModalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteCancelButton: {
    borderWidth: 1,
    borderColor: '#334155',
  },
  deleteConfirmButton: {},
  deleteModalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
