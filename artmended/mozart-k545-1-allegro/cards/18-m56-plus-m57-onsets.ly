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
  \mark \markup { \box \bold "m. 56" }
  b'8^\finger "(1)"->\f(
g''8)
e''8-.-3
c''8-.-1
d''8-2(
g''8)
e''8-.
c''8-.
  d''4^\finger "(2)"-.
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  g,16-5\(
b,16-4
d16-2
g16
g,16-5
c16-3
e16-2
g16
g,16
b,16
d16
g16
g,16
c16
e16
g16
  g,4_\finger "(5)"-.
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
