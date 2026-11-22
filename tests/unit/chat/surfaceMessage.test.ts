import { describe, expect, it } from 'vitest'
import type { UiSurface } from '../../../src/shared/a2uiSurface'
import {
  surfaceAnswer,
  surfaceClickMessage
} from '../../../src/renderer/src/features/chat/surfaceMessage'
import type { ChatItem } from '../../../src/renderer/src/features/chat/types'

const formSurface: UiSurface = {
  surfaceId: 'form',
  dataModel: { name: 'Weekly report', day: 'wed', tags: ['a', 'b'] },
  components: [
    { id: 'root', component: 'Column', children: ['name', 'day', 'tags', 'lbl', 'send'] },
    { id: 'name', component: 'TextField', label: 'Name', value: { '@path': '/name' } },
    {
      id: 'day',
      component: 'ChoicePicker',
      label: 'Day',
      options: [{ label: 'Wed', value: 'wed' }],
      value: { '@path': '/day' }
    },
    {
      id: 'tags',
      component: 'ChoicePicker',
      label: 'Tags',
      multiple: true,
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' }
      ],
      value: { '@path': '/tags' }
    },
    { id: 'lbl', component: 'Text', text: 'Create routine' },
    {
      id: 'send',
      component: 'Button',
      child: 'lbl',
      variant: 'primary',
      action: { event: { name: 'create' } }
    }
  ]
}

describe('surfaceClickMessage', () => {
  it('should send only the button label when there are no inputs', () => {
    const surface: UiSurface = {
      surfaceId: 'pick',
      dataModel: {},
      components: [
        { id: 'root', component: 'Column', children: ['lbl', 'btn'] },
        { id: 'lbl', component: 'Text', text: 'Move them' },
        { id: 'btn', component: 'Button', child: 'lbl', action: { event: { name: 'move' } } }
      ]
    }
    expect(surfaceClickMessage(surface, 'btn', {})).toBe('Move them')
  })

  it('should fold line breaks in a text field into spaces', () => {
    const surface: UiSurface = {
      surfaceId: 'note',
      dataModel: { body: 'line one\nline two' },
      components: [
        { id: 'root', component: 'Column', children: ['field', 'lbl', 'go'] },
        { id: 'field', component: 'TextField', label: 'Body', value: { '@path': '/body' } },
        { id: 'lbl', component: 'Text', text: 'Send' },
        { id: 'go', component: 'Button', child: 'lbl', action: { event: { name: 'send' } } }
      ]
    }
    expect(surfaceClickMessage(surface, 'go', surface.dataModel)).toBe(
      'Send\nBody: line one line two'
    )
  })

  it('should append input lines for a form', () => {
    const text = surfaceClickMessage(formSurface, 'send', formSurface.dataModel)
    expect(text).toBe('Create routine\nName: Weekly report\nDay: Wed\nTags: A, B')
  })
})

describe('surfaceAnswer', () => {
  const surfaceItem: ChatItem = {
    kind: 'surface',
    id: 's1',
    surface: {
      surfaceId: 'pick',
      dataModel: {},
      components: [
        { id: 'root', component: 'Column', children: ['btn'] },
        { id: 'lbl', component: 'Text', text: 'Wednesday' },
        { id: 'btn', component: 'Button', child: 'lbl', action: { event: { name: 'pick' } } }
      ]
    }
  }

  it('should be unanswered with no user message after it', () => {
    expect(surfaceAnswer([surfaceItem], surfaceItem, [])).toEqual({
      answered: false,
      pickedButtonId: null,
      values: null
    })
  })

  it('should mark the matching button when the user picked it', () => {
    const items: ChatItem[] = [
      surfaceItem,
      { kind: 'user', id: 'u1', text: 'Wednesday', images: [] }
    ]
    expect(surfaceAnswer(items, surfaceItem, [])).toMatchObject({
      answered: true,
      pickedButtonId: 'btn'
    })
  })

  it('should be answered without a button match when the user typed', () => {
    const items: ChatItem[] = [
      surfaceItem,
      { kind: 'user', id: 'u1', text: 'Something else', images: [] }
    ]
    expect(surfaceAnswer(items, surfaceItem, [])).toMatchObject({
      answered: true,
      pickedButtonId: null
    })
  })

  it('should show an answered form with what was sent, not what it started with', () => {
    const form: ChatItem = { kind: 'surface', id: 'f1', surface: formSurface }
    const sent: ChatItem = {
      kind: 'user',
      id: 'u2',
      text: 'Create routine\nName: Monthly report\nDay: Wed\nTags: B',
      images: []
    }
    expect(surfaceAnswer([form, sent], form, [])).toEqual({
      answered: true,
      pickedButtonId: 'send',
      values: { name: 'Monthly report', day: 'wed', tags: ['b'] }
    })
  })

  it('should count as answered while its own click still waits to go, and not after it is taken back', () => {
    const form: ChatItem = { kind: 'surface', id: 'f1', surface: formSurface }
    const waiting = 'Create routine\nName: Monthly report'
    expect(surfaceAnswer([form], form, [waiting])).toMatchObject({
      answered: true,
      pickedButtonId: 'send',
      values: { name: 'Monthly report' }
    })
    // The send failed or the user took the message back: the card can be answered again.
    expect(surfaceAnswer([form], form, []).answered).toBe(false)
    // A message of yours that waits but is not this card's does not settle it.
    expect(surfaceAnswer([form], form, ['Something else']).answered).toBe(false)
  })

  it('should give an answer to the card just before it when two cards share a button label', () => {
    const card = (id: string): ChatItem => ({
      kind: 'surface',
      id,
      surface: {
        surfaceId: id,
        dataModel: {},
        components: [
          { id: 'root', component: 'Column', children: ['go'] },
          { id: 'label', component: 'Text', text: 'Approve' },
          { id: 'go', component: 'Button', child: 'label', action: { event: { name: 'ok' } } }
        ]
      }
    })
    const [first, second] = [card('first'), card('second')]
    // Waiting to go: the newer card has it, the older one is only settled.
    expect(surfaceAnswer([first, second], second, ['Approve']).pickedButtonId).toBe('go')
    expect(surfaceAnswer([first, second], first, ['Approve'])).toEqual({
      answered: true,
      pickedButtonId: null,
      values: null
    })
    // Sent: the same holds once the message is in the chat.
    const sent: ChatItem = { kind: 'user', id: 'u1', text: 'Approve', images: [] }
    expect(surfaceAnswer([first, second, sent], first, []).pickedButtonId).toBeNull()
    expect(surfaceAnswer([first, second, sent], second, []).pickedButtonId).toBe('go')
  })

  it('should leave a form live when a card without buttons follows it', () => {
    const form: ChatItem = { kind: 'surface', id: 'f1', surface: formSurface }
    const chartOnly: ChatItem = {
      kind: 'surface',
      id: 'c1',
      surface: {
        surfaceId: 'c1',
        dataModel: {},
        components: [{ id: 'root', component: 'Text', text: 'Numbers' }]
      }
    }
    expect(surfaceAnswer([form, chartOnly], form, []).answered).toBe(false)
  })
})
