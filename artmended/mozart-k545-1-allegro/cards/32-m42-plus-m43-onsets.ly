\version "2.26.0"
#(set-global-staff-size 25)

\paper {
  indent = 0\mm
  top-margin = 4\mm
  bottom-margin = 4\mm
  left-margin = 4\mm
  right-margin = 4\mm
  paper-width = 150\mm
  paper-height = 75\mm
  print-page-number = ##f
  tagline = ##f
  page-breaking = #ly:one-page-breaking
}

upperCard = {
  \clef treble
  \key c \major
  \time 4/4
  \mark \markup { \box \bold "m. 42" }
  \override PhrasingSlur.direction = #1

f''2-1(\mp
a''4-3
c'''4-5
  e''4.-1_>
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  \clef "treble"

f'8-5(\p
c''8-1
a'8-3
c''8
f'8
c''8
a'8
c''8)
  g'8-4 s1*1/4
  \bar "|."
}

\score {
  \new PianoStaff <<
    \set PianoStaff.connectArpeggios = ##t
    \new Staff = "upper" \upperCard
    \new Staff = "lower" \lowerCard
  >>
  \layout {
    ragged-right = ##f
    system-count = 1
  }
}
