import { useReducer } from 'react';
import type { ViewMode, SidebarPanel } from '../types';

export interface FloatingReaction {
  id: string;
  emoji: string;
  name: string;
}

interface MeetingState {
  viewMode: ViewMode;
  sidebarPanel: SidebarPanel;
  pinnedId: string | null;
  isHandRaised: boolean;
  myParticipantId: string;
  activeSpeakerId: string | null;
  showLeaveModal: boolean;
  connectionStatus: 'connected' | 'connecting' | 'reconnecting' | 'disconnected';
  raisedHands: Set<string>;
  floatingReactions: FloatingReaction[];
  toolbarVisible: boolean;
}

type MeetingAction =
  | { type: 'SET_VIEW_MODE'; viewMode: ViewMode }
  | { type: 'TOGGLE_SIDEBAR'; panel: SidebarPanel }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'SET_PINNED'; id: string | null }
  | { type: 'SET_HAND_RAISED'; raised: boolean }
  | { type: 'SET_PARTICIPANT_ID'; id: string }
  | { type: 'SET_ACTIVE_SPEAKER'; id: string | null }
  | { type: 'SET_LEAVE_MODAL'; show: boolean }
  | { type: 'SET_CONNECTION_STATUS'; status: MeetingState['connectionStatus'] }
  | { type: 'UPDATE_RAISED_HANDS'; updater: (prev: Set<string>) => Set<string> }
  | { type: 'ADD_REACTION'; reaction: FloatingReaction }
  | { type: 'REMOVE_REACTION'; id: string }
  | { type: 'SET_TOOLBAR_VISIBLE'; visible: boolean };

const initialState: MeetingState = {
  viewMode: 'speaker',
  sidebarPanel: null,
  pinnedId: null,
  isHandRaised: false,
  myParticipantId: '',
  activeSpeakerId: null,
  showLeaveModal: false,
  connectionStatus: 'connecting',
  raisedHands: new Set(),
  floatingReactions: [],
  toolbarVisible: true,
};

function meetingReducer(state: MeetingState, action: MeetingAction): MeetingState {
  switch (action.type) {
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.viewMode };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarPanel: state.sidebarPanel === action.panel ? null : action.panel };
    case 'CLOSE_SIDEBAR':
      return { ...state, sidebarPanel: null };
    case 'SET_PINNED':
      return { ...state, pinnedId: action.id };
    case 'SET_HAND_RAISED':
      return { ...state, isHandRaised: action.raised };
    case 'SET_PARTICIPANT_ID':
      return { ...state, myParticipantId: action.id };
    case 'SET_ACTIVE_SPEAKER':
      return { ...state, activeSpeakerId: action.id };
    case 'SET_LEAVE_MODAL':
      return { ...state, showLeaveModal: action.show };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.status };
    case 'UPDATE_RAISED_HANDS':
      return { ...state, raisedHands: action.updater(state.raisedHands) };
    case 'ADD_REACTION':
      return { ...state, floatingReactions: [...state.floatingReactions, action.reaction] };
    case 'REMOVE_REACTION':
      return { ...state, floatingReactions: state.floatingReactions.filter((r) => r.id !== action.id) };
    case 'SET_TOOLBAR_VISIBLE':
      return { ...state, toolbarVisible: action.visible };
    default:
      return state;
  }
}

export function useMeetingReducer() {
  return useReducer(meetingReducer, initialState);
}
