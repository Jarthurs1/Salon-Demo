import { describe, it, expect } from 'vitest'
import {
  TAB_ORDER,
  getAdjacentTab,
  classifyHorizontalSwipe,
} from './swipeNav.js'

describe('tab swipe navigation', () => {
  it('orders tabs calendar → book → clients', () => {
    expect(TAB_ORDER).toEqual(['calendar', 'book', 'clients'])
  })

  it('maps swipe left/right to adjacent tabs from book', () => {
    expect(getAdjacentTab('book', 'left')).toBe('clients')
    expect(getAdjacentTab('book', 'right')).toBe('calendar')
  })

  it('returns null at the ends', () => {
    expect(getAdjacentTab('calendar', 'right')).toBeNull()
    expect(getAdjacentTab('clients', 'left')).toBeNull()
  })
})

describe('classifyHorizontalSwipe', () => {
  it('detects left and right swipes past threshold', () => {
    expect(
      classifyHorizontalSwipe({
        startX: 200,
        startY: 100,
        endX: 100,
        endY: 105,
      }),
    ).toBe('left')
    expect(
      classifyHorizontalSwipe({
        startX: 100,
        startY: 100,
        endX: 200,
        endY: 95,
      }),
    ).toBe('right')
  })

  it('ignores mostly vertical gestures', () => {
    expect(
      classifyHorizontalSwipe({
        startX: 100,
        startY: 50,
        endX: 130,
        endY: 200,
      }),
    ).toBeNull()
  })

  it('ignores short gestures', () => {
    expect(
      classifyHorizontalSwipe({
        startX: 100,
        startY: 100,
        endX: 120,
        endY: 100,
      }),
    ).toBeNull()
  })
})
